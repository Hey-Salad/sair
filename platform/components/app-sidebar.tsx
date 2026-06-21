"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import Link from "next/link"
import {
  PanelLeft,
  SquarePen,
  Search,
  ImageIcon,
  LayoutGrid,
  Telescope,
  Code2,
  FolderPlus,
  Settings,
  LogOut,
  Video,
} from "lucide-react"
import type { Tenant } from "@/lib/types"

const primaryNav = [
  { label: "New chat", icon: SquarePen },
  { label: "Search chats", icon: Search },
  { label: "Images", icon: ImageIcon },
  { label: "Apps", icon: LayoutGrid },
  { label: "Deep research", icon: Telescope },
  { label: "Codey", icon: Code2 },
]

const projectNav = [
  { label: "New project", icon: FolderPlus },
  { label: "Personal Config", icon: Settings },
]

export function AppSidebar({
  collapsed = false,
  onToggle,
  tenant = null,
  credits = 0,
  onLogout,
}: {
  collapsed?: boolean
  onToggle?: () => void
  tenant?: Tenant | null
  credits?: number
  onLogout?: () => void
}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const logoSrc =
    mounted && resolvedTheme === "light"
      ? "/heysalad-logo-black.png"
      : "/heysalad-logo-white.png"

  // Collapsed: narrow icon-only rail
  if (collapsed) {
    return (
      <aside className="flex h-screen w-[72px] shrink-0 flex-col items-center bg-sidebar text-sidebar-foreground">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open sidebar"
          className="mt-5 mb-2 rounded-md p-1 transition-opacity hover:opacity-80"
        >
          <Image
            src="/heysalad-icon.png"
            alt="HeySalad"
            width={48}
            height={48}
            priority
            unoptimized
            className="size-9 object-contain"
          />
        </button>

        <nav className="flex flex-col items-center gap-2 pt-2">
          {primaryNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              className="flex size-11 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <Icon className="size-5 text-muted-foreground" />
            </button>
          ))}
          <Link
            href="/streams"
            title="Streams"
            className="flex size-11 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Video className="size-5 text-red-400" />
          </Link>
        </nav>
      </aside>
    )
  }

  // Expanded: full sidebar
  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <Image
          src={logoSrc || "/placeholder.svg"}
          alt="HeySalad"
          width={586}
          height={200}
          priority
          unoptimized
          className="h-[3.24rem] w-auto object-contain"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle sidebar"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <PanelLeft className="size-5" />
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1 px-3 pt-3">
        {primaryNav.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Icon className="size-5 shrink-0 text-muted-foreground" />
            <span>{label}</span>
          </button>
        ))}
        <Link
          href="/streams"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Video className="size-5 shrink-0 text-red-400" />
          <span>Streams</span>
        </Link>
      </nav>

      {/* Projects */}
      <div className="px-6 pt-6 pb-2">
        <span className="text-sm text-muted-foreground">Projects</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {projectNav.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
          >
            <Icon className="size-5 shrink-0 text-muted-foreground" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Your chats */}
      <div className="px-6 pt-6 pb-1">
        <span className="text-sm text-muted-foreground">Your chats</span>
      </div>
      <div className="px-6">
        <span className="text-[15px] text-muted-foreground">No chats yet</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Promo card (only when not signed in to a workspace) */}
      {!tenant && (
        <div className="m-3 w-[calc(100%-1.5rem)] rounded-2xl bg-sidebar-accent p-4">
          <p className="text-sm font-semibold text-sidebar-foreground">Get personalised answers</p>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
            Sign in to save your chats, access history, and get the most out of HeySalad.
          </p>
          <button
            type="button"
            className="mt-4 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Workspace footer */}
      {tenant && (
        <div className="mt-auto flex items-center gap-1 border-t border-sidebar-border p-3">
          <button
            type="button"
            aria-label="Switch workspace"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-black text-sm font-semibold text-white">
              {tenant.name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-sidebar-foreground">
                {tenant.name}
              </span>
              <span className="block text-xs capitalize text-muted-foreground">
                {tenant.plan} &middot; {credits.toLocaleString("en-US")} credits
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
