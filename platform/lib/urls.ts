// Client-safe URL builders. No server-only imports (next/headers, db) so these
// can be used from both client and server components.

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "heysalad.io"
export const APP_SUBDOMAIN = "app"

const isProd = process.env.NODE_ENV === "production"

/** The generic app entry point: app.heysalad.io (login + workspace picker). */
export function appUrl(): string {
  return isProd ? `https://${APP_SUBDOMAIN}.${ROOT_DOMAIN}` : "/app"
}

/** A specific tenant's workspace URL (its subdomain). */
export function workspaceUrl(slug: string): string {
  return isProd ? `https://${slug}.${ROOT_DOMAIN}` : `http://${slug}.localhost:3000`
}
