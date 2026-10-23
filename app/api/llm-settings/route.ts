import { NextResponse } from "next/server";
import { apiError, isRecord } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import {
  getPublicLlmSettings,
  getUsageToday,
  saveLlmSettings,
  sharedConfig,
} from "@/lib/llm-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireUserId();
    const settings = await getPublicLlmSettings(userId);
    const shared = sharedConfig();
    const usageToday = await getUsageToday(userId);

    return NextResponse.json({
      settings,
      shared: {
        available: Boolean(shared),
        provider: shared?.provider ?? null,
        model: shared?.model ?? null,
        dailyLimit: shared?.dailyLimit ?? 0,
        usageToday,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return apiError("Expected a JSON object.", 400);
    }

    const userId = await requireUserId();
    const settings = await saveLlmSettings(userId, {
      provider: body.provider,
      model: body.model,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      useShared: body.useShared,
      clearApiKey: body.clearApiKey,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}
