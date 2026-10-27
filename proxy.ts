import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== request.headers.get("host")) {
          return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
      }
    }
  }

  if (pathname.startsWith("/api/")) {
    let limit = 300;
    const windowMs = 15 * 60 * 1000;

    if (pathname.startsWith("/api/auth/")) {
      limit = 10;
    } else if (pathname.startsWith("/api/llm-") || pathname.startsWith("/api/composio-")) {
      limit = 60;
    } else if (pathname === "/api/execute") {
      limit = 120;
    } else if (pathname === "/api/connect") {
      limit = 30;
    }

    const key = `${clientIp(request)}:${pathname}`;
    if (!rateLimit(key, limit, windowMs)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};