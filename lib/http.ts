import { NextResponse } from "next/server";
import { AuthError, UnauthorizedError } from "./errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function apiError(error: unknown, status = 500): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error("[api]", message);

  return NextResponse.json({ error: message }, { status });
}

export function cleanSlug(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isToolkitSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value);
}

export function isToolSlug(value: string): boolean {
  return /^[A-Za-z0-9_]{1,128}$/.test(value);
}
