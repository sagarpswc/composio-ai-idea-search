import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/errors";
import { apiError, cleanSlug, isRecord, isToolkitSlug } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

type ConnectOutcome =
  | { status: "connect"; redirectUrl: string; connectedAccountId: string }
  | { status: "already-connected" | "no-auth"; redirectUrl: null };

async function createConnection(
  request: Request,
  toolkit: string,
  returnPath: string
): Promise<ConnectOutcome> {
  const userId = await requireUserId();
  const session = await getSession(userId);

  const state = await session.toolkits({ toolkits: [toolkit] });
  const toolkitState = state.items.find(
    (item) => item.slug.toLowerCase() === toolkit
  );

  if (toolkitState?.isNoAuth) {
    return { status: "no-auth", redirectUrl: null };
  }

  if (toolkitState?.connection?.isActive) {
    return { status: "already-connected", redirectUrl: null };
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  const origin = configuredOrigin || new URL(request.url).origin;
  const callbackUrl = `${origin}${returnPath}?connected=${encodeURIComponent(toolkit)}`;

  const connectionRequest = await session.authorize(toolkit, { callbackUrl });

  if (!connectionRequest.redirectUrl) {
    throw new Error("Composio did not return a Connect Link.");
  }

  return {
    status: "connect",
    redirectUrl: connectionRequest.redirectUrl,
    connectedAccountId: connectionRequest.id,
  };
}

function noticeUrl(
  toolkit: string,
  key: "already" | "noauth",
  origin: string,
  returnPath: string
) {
  const url = new URL(returnPath, origin);
  url.searchParams.set(key, toolkit);
  return url;
}

/**
 * Browser navigation path used by the dashboard Connect button.
 *
 * The dashboard opens this route in the current tab. The 303 then sends that
 * tab to Composio and the provider; no popup or new window is opened.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const toolkit = cleanSlug(requestUrl.searchParams.get("toolkit")).toLowerCase();

  if (!isToolkitSlug(toolkit)) {
    return NextResponse.redirect(
      new URL("/dashboard?connectError=Choose%20a%20valid%20app.", requestUrl),
      303
    );
  }

  const returnPath =
    requestUrl.searchParams.get("returnTo") === "app"
      ? `/dashboard/apps/${encodeURIComponent(toolkit)}`
      : "/dashboard";

  try {
    const outcome = await createConnection(request, toolkit, returnPath);

    if (outcome.status === "connect") {
      return NextResponse.redirect(outcome.redirectUrl, 303);
    }

    return NextResponse.redirect(
      noticeUrl(
        toolkit,
        outcome.status === "no-auth" ? "noauth" : "already",
        requestUrl.origin,
        returnPath
      ),
      303
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.redirect(new URL("/login", requestUrl), 303);
    }

    const message =
      error instanceof Error ? error.message : "Could not create a Connect Link.";
    console.error("[connect]", message);

    const url = new URL(returnPath, requestUrl.origin);
    url.searchParams.set("connectError", message);
    return NextResponse.redirect(url, 303);
  }
}

/**
 * JSON API used by integrations and the smoke test. The dashboard uses the GET
 * route above so the browser performs a top-level, same-tab navigation.
 */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return apiError("Expected a JSON object.", 400);
    }

    const toolkit = cleanSlug(body.toolkit).toLowerCase();

    if (!isToolkitSlug(toolkit)) {
      return apiError("A valid toolkit slug is required.", 400);
    }

    const outcome = await createConnection(request, toolkit, "/dashboard");

    return NextResponse.json({
      alreadyConnected: outcome.status === "already-connected",
      isNoAuth: outcome.status === "no-auth",
      redirectUrl: outcome.redirectUrl,
      connectedAccountId:
        outcome.status === "connect" ? outcome.connectedAccountId : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
