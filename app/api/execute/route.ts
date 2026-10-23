import { NextResponse } from "next/server";
import { apiError, cleanSlug, isRecord, isToolSlug } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { getSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return apiError("Expected a JSON object.", 400);
    }

    const toolSlug = cleanSlug(body.toolSlug);

    if (!isToolSlug(toolSlug)) {
      return apiError("A valid tool slug is required.", 400);
    }

    const toolArguments = body.arguments ?? {};

    if (!isRecord(toolArguments)) {
      return apiError("Tool arguments must be a JSON object.", 400);
    }

    const userId = await requireUserId();
    const session = await getSession(userId);
    const result = await session.execute(toolSlug, toolArguments);

    return NextResponse.json({
      resultType: result.resultType,
      error: result.error,
      logId: result.logId,
      data: result.data,
    });
  } catch (error) {
    return apiError(error);
  }
}
