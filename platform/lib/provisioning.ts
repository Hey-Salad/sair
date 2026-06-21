// Tenant provisioning for Vercel for Platforms.
//
// Two ways a tenant gets an address (both enabled):
//   1. Subdomain  — <slug>.heysalad.io, available immediately via the wildcard
//      domain already attached to the project. No per-tenant Vercel call needed.
//   2. Custom domain — app.theirrestaurant.com, registered with Vercel per tenant
//      and verified once the tenant adds the required DNS record.
//
// All DB writes stay scoped to the tenant. When DATABASE_URL is unset the helpers
// run in demo mode (no-op persistence) so preview keeps working.

import { isDbConfigured, query } from "@/lib/db/client"
import { ROOT_DOMAIN } from "@/lib/tenant"
import {
  addDomainToProject,
  dnsInstructionsFor,
  getDomainStatus,
  isVercelConfigured,
  removeDomainFromProject,
  verifyDomain,
} from "@/lib/vercel/domains"
import type { Tenant, TenantPlan } from "@/lib/types"

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/
const RESERVED = new Set(["www", "app", "api", "admin", "auth", "oauth", "mail", "blog", "status"])

export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED.has(slug)
}

export function subdomainFor(slug: string): string {
  return `${slug}.${ROOT_DOMAIN}`
}

/** Is a subdomain slug still available? */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!isValidSlug(slug)) return false
  if (!isDbConfigured()) return true // demo mode
  const rows = await query<{ id: string }>(
    `select id from tenants where slug = $1 limit 1`,
    [slug],
  )
  return rows.length === 0
}

export interface TenantDomain {
  domain: string
  isPrimary: boolean
  verified: boolean
  isSubdomain: boolean
}

/** List all domains attached to a tenant (subdomain + any custom domains). */
export async function listDomains(tenant: Tenant): Promise<TenantDomain[]> {
  if (!isDbConfigured()) {
    // Demo mode: just the canonical subdomain.
    return [
      {
        domain: subdomainFor(tenant.slug),
        isPrimary: true,
        verified: true,
        isSubdomain: true,
      },
    ]
  }

  const rows = await query<{ domain: string; isPrimary: boolean; verified: boolean }>(
    `select domain, is_primary as "isPrimary", verified
       from domains where tenant_id = $1 order by is_primary desc, domain asc`,
    [tenant.id],
  )
  return rows.map((r) => ({
    ...r,
    isSubdomain: r.domain.endsWith(`.${ROOT_DOMAIN}`),
  }))
}

export interface CreateWorkspaceInput {
  name: string
  slug: string
  plan?: TenantPlan
  ownerUserId: string
}

/** Create a tenant + its subdomain, and make the creating user the owner. */
export async function createWorkspace(input: CreateWorkspaceInput): Promise<Tenant> {
  const slug = normalizeSlug(input.slug)
  if (!isValidSlug(slug)) throw new Error("Invalid workspace address.")
  if (!(await isSlugAvailable(slug))) throw new Error("That address is already taken.")

  const plan: TenantPlan = input.plan ?? "free"

  if (!isDbConfigured()) {
    // Demo mode: return an in-memory tenant.
    return {
      id: "00000000-0000-0000-0000-0000000000aa",
      slug,
      name: input.name,
      logoUrl: null,
      plan,
      status: "trialing",
    }
  }

  const rows = await query<Tenant>(
    `insert into tenants (slug, name, plan, status)
       values ($1, $2, $3, 'trialing')
     returning id, slug, name, logo_url as "logoUrl", plan, status`,
    [slug, input.name, plan],
  )
  const tenant = rows[0]

  await query(
    `insert into tenant_members (tenant_id, user_id, role)
       values ($1, $2, 'owner')
     on conflict (tenant_id, user_id) do nothing`,
    [tenant.id, input.ownerUserId],
  )

  // Record the canonical subdomain. Subdomains are served by the project's
  // wildcard domain, so they're verified immediately (no per-domain Vercel call).
  await query(
    `insert into domains (tenant_id, domain, is_primary, verified)
       values ($1, $2, true, true)
     on conflict (domain) do nothing`,
    [tenant.id, subdomainFor(slug)],
  )

  return tenant
}

export interface CustomDomainResult {
  domain: string
  verified: boolean
  dns: { type: "A" | "CNAME"; name: string; value: string }
  /** True when Vercel API isn't configured yet (instructions still returned). */
  pendingPlatformSetup: boolean
}

/** Attach a custom domain to a tenant and register it with Vercel. */
export async function addCustomDomain(
  tenantId: string,
  rawDomain: string,
): Promise<CustomDomainResult> {
  const domain = rawDomain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
  const dns = dnsInstructionsFor(domain)

  let verified = false
  let pendingPlatformSetup = false

  if (isVercelConfigured()) {
    const status = await addDomainToProject(domain)
    verified = status.verified
  } else {
    pendingPlatformSetup = true
  }

  if (isDbConfigured()) {
    await query(
      `insert into domains (tenant_id, domain, is_primary, verified)
         values ($1, $2, false, $3)
       on conflict (domain) do update set tenant_id = excluded.tenant_id, verified = excluded.verified`,
      [tenantId, domain, verified],
    )
  }

  return { domain, verified, dns, pendingPlatformSetup }
}

/** Re-check a custom domain's verification status and persist the result. */
export async function refreshCustomDomain(
  tenantId: string,
  domain: string,
): Promise<{ domain: string; verified: boolean; misconfigured: boolean }> {
  if (!isVercelConfigured()) {
    return { domain, verified: false, misconfigured: true }
  }

  // Trigger verification, then read back the live config.
  await verifyDomain(domain).catch(() => undefined)
  const status = await getDomainStatus(domain)

  if (isDbConfigured()) {
    await query(
      `update domains set verified = $3 where tenant_id = $1 and domain = $2`,
      [tenantId, domain, status.verified],
    )
  }

  return { domain, verified: status.verified, misconfigured: Boolean(status.misconfigured) }
}

/** Disconnect a custom domain from a tenant and remove it from the project. */
export async function removeCustomDomain(tenantId: string, domain: string): Promise<void> {
  if (isVercelConfigured()) {
    await removeDomainFromProject(domain).catch(() => undefined)
  }
  if (isDbConfigured()) {
    await query(`delete from domains where tenant_id = $1 and domain = $2`, [tenantId, domain])
  }
}
