// Tenant resolution for Vercel for Platforms.
//
// A tenant = a business (e.g. a restaurant) served at <slug>.heysalad.io or a
// custom domain (app.acmebistro.com). The middleware writes the resolved host
// into the `x-tenant-host` header; server code calls getTenantFromHost() to
// load the tenant. Every downstream query MUST filter by tenant.id.

import { headers } from "next/headers"
import { isDbConfigured, query } from "@/lib/db/client"
import type { Tenant } from "@/lib/types"
import { APP_SUBDOMAIN, ROOT_DOMAIN, workspaceUrl } from "@/lib/urls"

export { ROOT_DOMAIN, APP_SUBDOMAIN, workspaceUrl }

const DEMO_TENANT: Tenant = {
  id: "00000000-0000-0000-0000-0000000000aa",
  slug: "acme-bistro",
  name: "Acme Bistro",
  logoUrl: null,
  plan: "pro",
  status: "active",
}

export type HostType = "marketing" | "app" | "tenant"

/**
 * Classify an incoming host:
 *   - "marketing" → apex / www (heysalad.io) → landing page
 *   - "app"       → app.heysalad.io → login + workspace picker
 *   - "tenant"    → <slug>.heysalad.io or a custom domain → a workspace
 */
export function getHostType(host: string | null | undefined): HostType {
  if (!host) return "marketing"
  const hostname = host.split(":")[0].toLowerCase()

  // app.heysalad.io  (and app.localhost for local dev)
  if (hostname === `${APP_SUBDOMAIN}.${ROOT_DOMAIN}` || hostname === `${APP_SUBDOMAIN}.localhost`) {
    return "app"
  }

  // Apex / www / bare localhost → marketing
  if (
    hostname === ROOT_DOMAIN ||
    hostname === `www.${ROOT_DOMAIN}` ||
    hostname === "localhost"
  ) {
    return "marketing"
  }

  // A tenant subdomain (slug present) → tenant
  if (slugFromHost(host)) return "tenant"

  // Anything else is a custom domain mapped to a tenant.
  return "tenant"
}

/** Extract the tenant slug from a hostname, or null for the root/marketing site. */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!host) return null
  const hostname = host.split(":")[0].toLowerCase()

  // Local development: <slug>.localhost
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(".localhost", "")
    if (sub && sub !== "www" && sub !== APP_SUBDOMAIN) return sub
    return null
  }

  // Subdomain of the root domain: <slug>.heysalad.io
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.slice(0, -1 * (ROOT_DOMAIN.length + 1))
    if (sub && sub !== "www" && sub !== APP_SUBDOMAIN) return sub
    return null
  }

  // Anything else is treated as a custom domain (resolved via the domains table).
  if (hostname === ROOT_DOMAIN || hostname === "localhost") return null
  return null // custom-domain lookups go through getTenantByDomain()
}

export interface WorkspaceSummary extends Tenant {
  role: string
}

/** List every workspace a user belongs to (via tenant_members). */
export async function getUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  if (!isDbConfigured()) {
    // Demo mode: a couple of sample workspaces for the picker.
    return [
      { ...DEMO_TENANT, role: "owner" },
      {
        id: "00000000-0000-0000-0000-0000000000bb",
        slug: "harvest-kitchen",
        name: "Harvest Kitchen",
        logoUrl: null,
        plan: "free",
        status: "active",
        role: "admin",
      },
    ]
  }

  return query<WorkspaceSummary>(
    `select t.id, t.slug, t.name, t.logo_url as "logoUrl", t.plan, t.status, m.role
       from tenants t
       join tenant_members m on m.tenant_id = t.id
      where m.user_id = $1 and t.status != 'suspended'
      order by t.name asc`,
    [userId],
  )
}

/** Resolve the active tenant for the current request (from the proxy header). */
export async function getCurrentTenant(): Promise<Tenant | null> {
  const host = (await headers()).get("x-tenant-host")
  return getTenantFromHost(host)
}

export async function getTenantFromHost(host: string | null): Promise<Tenant | null> {
  if (!isDbConfigured()) return DEMO_TENANT // demo mode

  const slug = slugFromHost(host)
  if (slug) {
    const rows = await query<Tenant>(
      `select id, slug, name, logo_url as "logoUrl", plan, status
         from tenants where slug = $1 and status != 'suspended' limit 1`,
      [slug],
    )
    return rows[0] ?? null
  }

  // Custom domain path
  if (host) {
    const hostname = host.split(":")[0].toLowerCase()
    const rows = await query<Tenant>(
      `select t.id, t.slug, t.name, t.logo_url as "logoUrl", t.plan, t.status
         from tenants t join domains d on d.tenant_id = t.id
        where d.domain = $1 and d.verified = true limit 1`,
      [hostname],
    )
    return rows[0] ?? null
  }

  return null
}
