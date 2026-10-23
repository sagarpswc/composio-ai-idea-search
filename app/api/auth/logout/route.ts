import { NextResponse } from "next/server";
import { destroySessionCookie } from "@/lib/auth";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroySessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
