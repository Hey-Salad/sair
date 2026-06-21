// Next.js 16 proxy (formerly middleware) — runs on every request.
//
// Its only job here is tenant resolution for Vercel for Platforms: read the
// incoming Host and forward it as `x-tenant-host` so server code can resolve
// the tenant. Auth verification happens in lib/auth.ts at the data layer.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? ""

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-tenant-host", host)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
