// HeySalad auth integration point.
//
// Auth is REUSED from HeySalad — we never store passwords here. This module's
// job: take the incoming request, verify the HeySalad identity, and return a
// stable user. Plug in whichever pattern HeySalad uses:
//
//   * JWT / JWKS  -> verify the bearer token signature with HEYSALAD_JWKS_URL,
//                    read the user id from the `sub` claim.
//   * OIDC / SSO  -> exchange/verify session via the OIDC provider.
//   * Shared cookie -> call HeySalad's `GET /me` with the forwarded cookie.
//
// Until credentials are configured, a demo user is returned so the app runs.

import type { HeySaladUser } from "@/lib/types"

const DEMO_USER: HeySaladUser = {
  id: "00000000-0000-0000-0000-000000000001",
  externalId: "demo-user",
  email: "owner@acmebistro.com",
  displayName: "Demo Owner",
  avatarUrl: null,
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.HEYSALAD_JWKS_URL || process.env.HEYSALAD_OIDC_ISSUER)
}

/**
 * Verify the HeySalad identity from the request and return the user.
 * Returns null when the request is unauthenticated (once auth is configured).
 */
export async function getHeySaladUser(_request?: Request): Promise<HeySaladUser | null> {
  if (!isAuthConfigured()) {
    // Demo mode — lets the UI render before HeySalad auth is wired up.
    return DEMO_USER
  }

  // TODO: implement real verification once HEYSALAD_* env vars are provided.
  //   const token = readBearer(_request)
  //   const claims = await verifyJwt(token, process.env.HEYSALAD_JWKS_URL!)
  //   return mapClaimsToUser(claims)
  throw new Error(
    "HeySalad auth env vars are set but verification is not implemented yet. See lib/auth.ts.",
  )
}
