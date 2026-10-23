import { NextResponse } from "next/server";
import { apiError, isRecord } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { enhanceIdeaSearchWithLocalModel, searchComposioIdeas } from "@/lib/composio-idea-search";

export const runtime = "nodejs";

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

    const requestedLimit = typeof body.limit === "number" ? body.limit : 8;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 20)
      : 8;

    await requireUserId();
    const result = await searchComposioIdeas(requirement, limit);
    const ai = await enhanceIdeaSearchWithLocalModel(requirement, result);

    return NextResponse.json({
      ...result,
      aiSteps: ai?.steps ?? null,
      aiModel: ai?.model ?? null,
      note: "Steps only. No implementation code is returned; combinations are ranked by match, then fewer total scopes.",
    });
  } catch (error) {
    return apiError(error);
  }
}