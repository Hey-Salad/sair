// Single source of truth for where the HeySalad JWT lives on the client.
//
// IMPORTANT: This is the ONLY module that touches the raw storage mechanism.
// Today it uses localStorage (per the integration spec). To move to httpOnly
// cookies later, change only this file — nothing else imports localStorage.

const TOKEN_KEY = "heysalad_token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // storage unavailable (private mode, quota) — fail silently
  }
}

export function clearToken(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

/**
 * Decode a JWT payload without verifying the signature (signature verification
 * is the server's job via /api/auth/validate). Used only to read `exp` so we
 * can proactively detect an expired token client-side.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".")
    if (!payload) return null
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** Returns true if the token has an `exp` claim that is in the past. */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== "number") return false // no exp claim — let server decide
  // exp is in seconds; add a small skew buffer
  return Date.now() >= exp * 1000 - 5000
}
