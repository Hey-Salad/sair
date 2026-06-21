"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Loader2, Plus, ArrowRight, Check, X } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { workspaceUrl } from "@/lib/urls"
import type { WorkspaceSummary } from "@/lib/tenant"

export function WorkspacePicker() {
  const router = useRouter()
  const { status, user, logout } = useAuth()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => setMounted(true), [])

  // Protect: redirect unauthenticated users to login.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  // Load the user's workspaces once authenticated.
  useEffect(() => {
    if (status !== "authenticated") return
    let active = true
    fetch("/api/workspaces/mine")
      .then((r) => r.json())
      .then((data) => {
        if (active) setWorkspaces(data.workspaces ?? [])
      })
      .catch(() => active && setWorkspaces([]))
    return () => {
      active = false
    }
  }, [status])

  const logoSrc =
    mounted && resolvedTheme === "light" ? "/heysalad-logo-black.png" : "/heysalad-logo-white.png"

  if (status !== "authenticated") {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-salad" />
        <span className="sr-only">Loading</span>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <Image
          src={logoSrc || "/placeholder.svg"}
          alt="HeySalad"
          width={586}
          height={200}
          priority
          unoptimized
          className="h-9 w-auto object-contain"
        />
        <button
          type="button"
          onClick={logout}
          className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-pretty text-3xl font-bold tracking-tight text-foreground">
          {user?.displayName ? `Welcome back, ${user.displayName.split(" ")[0]}` : "Your workspaces"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Select a workspace to continue, or create a new one for your business.
        </p>

        {workspaces === null ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="size-6 animate-spin text-salad" />
          </div>
        ) : creating ? (
          <CreateWorkspace onCancel={() => setCreating(false)} />
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <a
                  href={workspaceUrl(ws.slug)}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-black text-base font-semibold text-white">
                    {ws.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-card-foreground">
                      {ws.name}
                    </span>
                    <span className="block text-sm capitalize text-muted-foreground">
                      {ws.slug}.heysalad.io &middot; {ws.role}
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}

            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-4 rounded-xl border border-dashed border-border p-4 text-left transition-colors hover:bg-accent"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-salad text-primary-foreground">
                  <Plus className="size-5" />
                </span>
                <span className="text-[15px] font-medium text-foreground">Create new workspace</span>
              </button>
            </li>
          </ul>
        )}
      </div>
    </main>
  )
}

function CreateWorkspace({ onCancel }: { onCancel: () => void }) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [touchedSlug, setTouchedSlug] = useState(false)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-derive slug from name until the user edits it directly.
  const effectiveSlug = touchedSlug ? slug : name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

  const checkSlug = useCallback(async (value: string) => {
    if (!value) return setAvailable(null)
    try {
      const res = await fetch(`/api/workspaces?slug=${encodeURIComponent(value)}`)
      const data = await res.json()
      setAvailable(Boolean(data.available))
    } catch {
      setAvailable(null)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => void checkSlug(effectiveSlug), 350)
    return () => clearTimeout(t)
  }, [effectiveSlug, checkSlug])

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: effectiveSlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create workspace")
      window.location.href = workspaceUrl(data.tenant.slug)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-card-foreground">Create a workspace</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This becomes your team&apos;s home at its own subdomain.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Business name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Bistro"
            className="h-12 w-full rounded-lg border border-border bg-input px-4 text-[15px] text-foreground outline-none transition-colors focus:border-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Workspace address</span>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input px-4 focus-within:border-ring">
            <input
              value={effectiveSlug}
              onChange={(e) => {
                setTouchedSlug(true)
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }}
              placeholder="acme-bistro"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none"
            />
            <span className="shrink-0 text-[15px] text-muted-foreground">.heysalad.io</span>
            {available === true && <Check className="size-4 shrink-0 text-salad" />}
            {available === false && <X className="size-4 shrink-0 text-destructive" />}
          </div>
          {available === false && (
            <span className="text-xs text-destructive">That address is taken — try another.</span>
          )}
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!name.trim() || !effectiveSlug || available === false || busy}
            onClick={submit}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Create workspace
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
