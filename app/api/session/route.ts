import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireUserId();
    const session = await getSession(userId);

    return NextResponse.json({
      ready: true,
      userId,
      sessionActive: Boolean(session.sessionId),
    });
  } catch (error) {
    return apiError(error);
  }
}
