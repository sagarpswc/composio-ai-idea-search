import { NextResponse } from "next/server";
import { createSessionCookie, registerUser } from "@/lib/auth";
import { apiError, isRecord } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return apiError("Expected a JSON object.", 400);
    }

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await registerUser(email, password);
    await createSessionCookie(user);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
