import { NextResponse } from "next/server";
import { searchComposioIdeas } from "@/lib/composio-idea-search";
import { apiError, isRecord } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

type ConnectionInfo = {
  known: boolean;
  connected: boolean;
  isNoAuth: boolean;
  status: string | null;
};

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return apiError("Expected a JSON object.", 400);
    }

    const requirement = typeof body.requirement === "string" ? body.requirement.trim() : "";
    if (!requirement) {
      return apiError("A requirement is required.", 400);
    }

    if (requirement.length > 4000) {
      return apiError("Keep the requirement below 4,000 characters.", 400);
    }

    const requestedLimit = typeof body.limit === "number" ? body.limit : 8;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20)
      : 8;

    const userId = await requireUserId();
    const result = await searchComposioIdeas(requirement, limit);
    const appSlugs = [
      ...new Set(
        [result.best, ...result.alternatives]
          .flatMap((plan) => plan?.apps ?? [])
          .map((app) => app.slug)
      ),
    ].slice(0, 12);
    const connections: Record<string, ConnectionInfo> = Object.fromEntries(
      appSlugs.map((slug) => [
        slug,
        { known: false, connected: false, isNoAuth: false, status: null },
      ])
    );

    if (appSlugs.length > 0) {
      try {
        const session = await getSession(userId);
        const status = await session.toolkits({ toolkits: appSlugs });

        for (const item of status.items) {
          const slug = item.slug.toLowerCase();
          const isNoAuth = Boolean(item.isNoAuth);
          connections[slug] = {
            known: true,
            connected: isNoAuth || Boolean(item.connection?.isActive),
            isNoAuth,
            status: item.connection?.connectedAccount?.status ?? null,
          };
        }
      } catch {
        // Keep the plan useful even when the live connection check is unavailable.
      }
    }

    return NextResponse.json({
      ...result,
      connections,
      note: result.note,
    });
  } catch (error) {
    return apiError(error);
  }
}
