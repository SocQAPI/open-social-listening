import { NextResponse, type NextRequest } from "next/server";

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** When OSL_PASSWORD is set, every page and API route requires HTTP basic auth (any user name). */
export function proxy(request: NextRequest) {
  const password = process.env.OSL_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice("Basic ".length).trim());
      const separator = decoded.indexOf(":");
      const supplied = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (safeEqual(supplied, password)) return NextResponse.next();
    } catch {
      // Malformed header: fall through to the challenge.
    }
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Open Social Listening", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
