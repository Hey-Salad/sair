"use client"

import { useState } from "react"
import { Check, Copy, Globe, Loader2, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react"
import type { TenantDomain } from "@/lib/provisioning"

interface DnsRecord {
  type: "A" | "CNAME"
  name: string
  value: string
}

interface PendingDomain extends DnsRecord {
  domain: string
  verified: boolean
  pendingPlatformSetup: boolean
}

export function DomainManager({
  initialDomains,
  rootDomain,
}: {
  initialDomains: TenantDomain[]
  rootDomain: string
}) {
  const [domains, setDomains] = useState<TenantDomain[]>(initialDomains)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingDomain | null>(null)
  const [checking, setChecking] = useState<string | null>(null)

  async function addDomain(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/workspaces/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: input.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add domain")
      setPending({
        domain: data.domain,
        verified: data.verified,
        pendingPlatformSetup: data.pendingPlatformSetup,
        ...data.dns,
      })
      setDomains((d) => [
        ...d,
        { domain: data.domain, isPrimary: false, verified: data.verified, isSubdomain: false },
      ])
      setInput("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain")
    } finally {
      setBusy(false)
    }
  }

  async function verify(domain: string) {
    setChecking(domain)
    try {
      const res = await fetch("/api/workspaces/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json()
      if (res.ok) {
        setDomains((d) => d.map((x) => (x.domain === domain ? { ...x, verified: data.verified } : x)))
        if (pending?.domain === domain) setPending({ ...pending, verified: data.verified })
      }
    } finally {
      setChecking(null)
    }
  }

  async function remove(domain: string) {
    await fetch("/api/workspaces/domains", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    })
    setDomains((d) => d.filter((x) => x.domain !== domain))
    if (pending?.domain === domain) setPending(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Add custom domain */}
      <form onSubmit={addDomain} className="flex flex-col gap-2">
        <label htmlFor="domain" className="text-sm font-medium text-foreground">
          Add a custom domain
        </label>
        <div className="flex gap-2">
          <input
            id="domain"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="app.yourrestaurant.com"
            className="h-11 flex-1 rounded-lg border border-border bg-input px-4 text-[15px] text-foreground outline-none transition-colors focus:border-ring"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* DNS instructions for the most recently added domain */}
      {pending && !pending.verified && (
        <DnsInstructions pending={pending} />
      )}

      {/* Domain list */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground">Connected domains</p>
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
          {domains.map((d) => (
            <li key={d.domain} className="flex items-center gap-3 px-4 py-3">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{d.domain}</span>
              {d.isSubdomain && (
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                  Subdomain
                </span>
              )}
              {d.verified ? (
                <span className="flex items-center gap-1 rounded-full bg-salad/15 px-2.5 py-1 text-xs font-medium text-salad">
                  <Check className="size-3" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                  <TriangleAlert className="size-3" /> Pending DNS
                </span>
              )}
              {!d.isSubdomain && (
                <>
                  <button
                    type="button"
                    onClick={() => verify(d.domain)}
                    aria-label="Re-check verification"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <RefreshCw className={`size-4 ${checking === d.domain ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(d.domain)}
                    aria-label="Remove domain"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Every workspace is always reachable at{" "}
          <span className="text-foreground">your-slug.{rootDomain}</span>.
        </p>
      </div>
    </div>
  )
}

function DnsInstructions({ pending }: { pending: PendingDomain }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        Add this DNS record in Cloudflare for{" "}
        <span className="text-salad">{pending.domain}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        In Cloudflare, set the record&apos;s proxy status to{" "}
        <span className="font-medium text-foreground">DNS only</span> (grey cloud) so Vercel can
        issue the SSL certificate.
      </p>
      <div className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2 rounded-lg bg-secondary p-3 font-mono text-[13px]">
        <span className="text-muted-foreground">Type</span>
        <CopyValue value={pending.type} />
        <span className="text-muted-foreground">Name</span>
        <CopyValue value={pending.name} />
        <span className="text-muted-foreground">Value</span>
        <CopyValue value={pending.value} />
      </div>
      {pending.pendingPlatformSetup && (
        <p className="text-xs text-muted-foreground">
          Note: the Vercel domain API isn&apos;t configured yet, so this domain is recorded but not
          live. Set <span className="text-foreground">VERCEL_TOKEN</span>,{" "}
          <span className="text-foreground">VERCEL_PROJECT_ID</span>, and{" "}
          <span className="text-foreground">VERCEL_TEAM_ID</span> to activate it.
        </p>
      )}
    </div>
  )
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex items-center justify-between gap-2 text-left text-foreground transition-colors hover:text-salad"
    >
      <span className="truncate">{value}</span>
      {copied ? <Check className="size-3.5 text-salad" /> : <Copy className="size-3.5 opacity-60" />}
    </button>
  )
}
