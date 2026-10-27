import { NextResponse } from "next/server";
import { buildPlaygroundSetup } from "@/lib/composio-playground-ai";
import { apiError, isRecord } from "@/lib/http";
import { requireUserId } from "@/lib/identity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return apiError("Expected a JSON object.", 400);
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return apiError("Describe the tool call you want to build.", 400);
    }

    if (prompt.length > 4000) {
      return apiError("Keep the prompt below 4,000 characters.", 400);
    }

    const toolSlug =
      typeof body.toolSlug === "string" && body.toolSlug.trim()
        ? body.toolSlug.trim()
        : undefined;

    const userId = await requireUserId();
    const setup = await buildPlaygroundSetup(userId, prompt, toolSlug);

    return NextResponse.json(setup);
  } catch (error) {
    return apiError(error);
  }
}
