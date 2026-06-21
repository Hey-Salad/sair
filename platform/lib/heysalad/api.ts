// Reusable helper for the HeySalad OAuth API. This is the source of truth for
// authentication — do NOT add a custom backend auth system here.
//
// Base: https://oauth.heysalad.app

import { getToken } from "./token-storage"

export const HEYSALAD_OAUTH_BASE = "https://oauth.heysalad.app"

export interface HeySaladProfile {
  id: string
  email: string | null
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  [key: string]: unknown
}

export class HeySaladApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "HeySaladApiError"
    this.status = status
  }
}

/** Resolve this app's callback URL for OAuth redirects. */
export function getCallbackUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000")
  return `${base}/auth/callback`
}

/** Build the provider start URL with our callback as the redirect target. */
export function getOAuthStartUrl(provider: "google" | "github"): string {
  const redirect = encodeURIComponent(getCallbackUrl())
  return `${HEYSALAD_OAUTH_BASE}/api/auth/${provider}/start?redirect=${redirect}`
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = false } = options
  const headers: Record<string, string> = {}

  if (body !== undefined) headers["Content-Type"] = "application/json"

  if (auth) {
    const token = getToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${HEYSALAD_OAUTH_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const data = await res.json()
      message = (data?.error as string) || (data?.message as string) || message
    } catch {
      // non-JSON error body
    }
    throw new HeySaladApiError(message, res.status)
  }

  // Some endpoints (validate) may return empty bodies
  const text = await res.text()
  return (text ? JSON.parse(text) : {}) as T
}

/** Email OTP — step 1: request a code. */
export function sendEmailOtp(email: string): Promise<{ ok?: boolean }> {
  return request("/api/auth/send-email-otp", { method: "POST", body: { email } })
}

/** Email OTP — step 2: verify and receive a token. */
export function verifyEmailOtp(input: {
  email: string
  code: string
  firstName?: string
  lastName?: string
}): Promise<{ token: string }> {
  return request("/api/auth/verify-email-otp", { method: "POST", body: input })
}

/** Validate the current bearer token. Throws on invalid/expired. */
export function validateToken(): Promise<unknown> {
  return request("/api/auth/validate", { method: "POST", auth: true })
}

/** Fetch the authenticated user's profile. */
export function fetchProfile(): Promise<HeySaladProfile> {
  return request<HeySaladProfile>("/api/profile", { auth: true })
}

/** Build a friendly display name from a profile. */
export function profileDisplayName(p: HeySaladProfile): string {
  if (p.displayName) return p.displayName
  if (p.name) return p.name
  const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim()
  if (full) return full
  return p.email ?? "Account"
}
