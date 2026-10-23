import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const cursor = searchParams.get("cursor")?.trim() || undefined;
    const connectedOnly = searchParams.get("connected") === "true";
    const requestedLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const userId = await requireUserId();
    const session = await getSession(userId);
    const result = await session.toolkits({
      limit,
      cursor,
      search,
      isConnected: connectedOnly || undefined,
    });

    return NextResponse.json({
      items: result.items.map((item) => ({
        slug: item.slug,
        name: item.name,
        logo: item.logo ?? null,
        isNoAuth: item.isNoAuth,
        isConnected: item.connection?.isActive ?? false,
        status: item.connection?.connectedAccount?.status ?? null,
      })),
      nextCursor: result.cursor ?? null,
      totalPages: result.totalPages,
      pageSize: limit,
    });
  } catch (error) {
    return apiError(error);
  }
}
