import { NextResponse } from "next/server";
import { getComposio } from "@/lib/composio";
import { apiError, cleanSlug, isRecord, isToolkitSlug } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

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

    const userId = await requireUserId();
    const session = await getSession(userId);
    const state = await session.toolkits({ toolkits: [toolkit] });
    const toolkitState = state.items.find(
      (item) => item.slug.toLowerCase() === toolkit
    );
    const connectedAccountId =
      toolkitState?.connection?.connectedAccount?.id;

    if (!toolkitState?.connection?.isActive || !connectedAccountId) {
      return apiError("That app is not connected for this account.", 400);
    }

    await getComposio().connectedAccounts.delete(connectedAccountId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
