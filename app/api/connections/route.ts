import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

const LIMIT = 50;
const MAX_PAGES = 20;

export async function GET() {
  try {
    const userId = await requireUserId();
    const session = await getSession(userId);
    const items = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await session.toolkits({
        isConnected: true,
        limit: LIMIT,
        cursor,
      });

      items.push(...result.items);
      cursor = result.cursor || undefined;

      if (!cursor) {
        break;
      }
    }

    return NextResponse.json({
      items: items.map((item) => ({
        slug: item.slug,
        name: item.name,
        logo: item.logo ?? null,
        isNoAuth: item.isNoAuth,
        isConnected: item.connection?.isActive ?? false,
        status: item.connection?.connectedAccount?.status ?? null,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
