import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { requireUserId } from "@/lib/identity";
import { testLlmConfig } from "@/lib/llm-settings";

export const runtime = "nodejs";

export async function POST() {
  try {
    const userId = await requireUserId();
    const result = await testLlmConfig(userId);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
