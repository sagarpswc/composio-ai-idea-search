import { NextResponse } from "next/server";
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

    const query = cleanSlug(body.query);

    if (!query) {
      return apiError("A search query is required.", 400);
    }

    const rawToolkits = body.toolkits;
    let toolkits: string[] | undefined;

    if (rawToolkits !== undefined) {
      if (!Array.isArray(rawToolkits) || rawToolkits.some((item) => typeof item !== "string")) {
        return apiError("toolkits must be an array of toolkit slugs.", 400);
      }

      toolkits = rawToolkits
        .map((item) => String(item).trim().toLowerCase())
        .filter(isToolkitSlug);

      if (toolkits.length !== rawToolkits.length) {
        return apiError("toolkits contains an invalid slug.", 400);
      }
    }

    const userId = await requireUserId();
    const session = await getSession(userId);
    const result = await session.search({ query, toolkits });

    return NextResponse.json({
      success: result.success,
      error: result.error,
      tools: Object.values(result.toolSchemas)
        .slice(0, 30)
        .map((tool) => ({
          slug: tool.toolSlug,
          toolkit: tool.toolkit,
          description: tool.description ?? null,
        })),
      connections: result.toolkitConnectionStatuses.map((status) => ({
        toolkit: status.toolkit,
        connected: status.hasActiveConnection,
        message: status.statusMessage,
      })),
      guidance: result.nextStepsGuidance,
    });
  } catch (error) {
    return apiError(error);
  }
}
