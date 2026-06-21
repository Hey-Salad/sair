// Vercel for Platforms — domain management via the Vercel REST API.
//
// This is the integration that lets each tenant get its own address:
//   - Subdomains:    <slug>.heysalad.io  (covered by a wildcard domain on the project)
//   - Custom domains: app.theirrestaurant.com (added + verified per tenant)
//
// DNS note (Cloudflare): heysalad.io is on Cloudflare. For wildcard subdomains
// add a DNS-only (grey cloud) CNAME `*.heysalad.io -> cname.vercel-dns.com`.
// For tenant custom domains, the tenant adds a CNAME to cname.vercel-dns.com
// (or an A record to 76.76.21.21 for apex domains). Vercel issues SSL automatically.
//
// Required env:
//   VERCEL_TOKEN       — token with access to the project's team
//   VERCEL_PROJECT_ID  — the project these domains attach to
//   VERCEL_TEAM_ID     — team scope (hey-salad-inc)

const API = "https://api.vercel.com"

export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com"
export const VERCEL_A_RECORD = "76.76.21.21"

export function isVercelConfigured(): boolean {
  return Boolean(
    process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TEAM_ID,
  )
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
    "Content-Type": "application/json",
  }
}

function teamQuery(): string {
  return `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID ?? "")}`
}

export interface VercelDomainVerification {
  type: string
  domain: string
  value: string
  reason: string
}

export interface VercelDomainStatus {
  name: string
  verified: boolean
  // Present when the domain still needs DNS records configured.
  verification?: VercelDomainVerification[]
  // Misconfigured = DNS not pointing at Vercel yet.
  misconfigured?: boolean
}

interface VercelError {
  error?: { code?: string; message?: string }
}

async function vercelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  })

  const json = (await res.json().catch(() => ({}))) as T & VercelError
  if (!res.ok) {
    const message = json?.error?.message ?? `Vercel API error (${res.status})`
    throw new Error(message)
  }
  return json as T
}

/** Attach a domain (subdomain or custom) to the Vercel project. */
export async function addDomainToProject(domain: string): Promise<VercelDomainStatus> {
  const projectId = process.env.VERCEL_PROJECT_ID
  return vercelFetch<VercelDomainStatus>(
    `/v10/projects/${projectId}/domains${teamQuery()}`,
    { method: "POST", body: JSON.stringify({ name: domain }) },
  )
}

/** Remove a domain from the project (e.g. when a tenant disconnects it). */
export async function removeDomainFromProject(domain: string): Promise<{ ok: boolean }> {
  const projectId = process.env.VERCEL_PROJECT_ID
  await vercelFetch(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
    { method: "DELETE" },
  )
  return { ok: true }
}

/** Read a domain's current verification / configuration status. */
export async function getDomainStatus(domain: string): Promise<VercelDomainStatus> {
  const projectId = process.env.VERCEL_PROJECT_ID
  const [domainInfo, config] = await Promise.all([
    vercelFetch<VercelDomainStatus>(
      `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
    ),
    vercelFetch<{ misconfigured?: boolean }>(
      `/v6/domains/${encodeURIComponent(domain)}/config${teamQuery()}`,
    ),
  ])
  return { ...domainInfo, misconfigured: config.misconfigured }
}

/** Ask Vercel to (re)verify a domain after the tenant has added DNS records. */
export async function verifyDomain(domain: string): Promise<VercelDomainStatus> {
  const projectId = process.env.VERCEL_PROJECT_ID
  return vercelFetch<VercelDomainStatus>(
    `/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}/verify${teamQuery()}`,
    { method: "POST" },
  )
}

/**
 * The DNS records a tenant must add at their registrar/Cloudflare to point a
 * custom domain at Vercel. Apex domains use an A record; subdomains use a CNAME.
 */
export function dnsInstructionsFor(domain: string): {
  type: "A" | "CNAME"
  name: string
  value: string
} {
  const labels = domain.split(".")
  const isApex = labels.length <= 2
  return isApex
    ? { type: "A", name: "@", value: VERCEL_A_RECORD }
    : { type: "CNAME", name: labels[0], value: VERCEL_CNAME_TARGET }
}
