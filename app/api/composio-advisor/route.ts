import { NextResponse } from "next/server";
import { apiError, isRecord } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { suggestComposioCombinations } from "@/lib/composio-advisor";

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

    const requestedLimit = typeof body.limit === "number" ? body.limit : 10;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 25)
      : 10;

    await requireUserId();
    const suggestions = await suggestComposioCombinations(requirement, limit);

    return NextResponse.json({
      requirement,
      suggestions,
      note: "Suggestions are ranked by requirement match, then by fewer requested scopes.",
    });
  } catch (error) {
    return apiError(error);
  }
}