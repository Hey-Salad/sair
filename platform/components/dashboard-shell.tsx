"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChatMain } from "@/components/chat-main"
import { useAuth } from "@/components/auth/auth-provider"
import type { Tenant } from "@/lib/types"

export function DashboardShell({
  tenant,
  credits,
}: {
  tenant: Tenant | null
  credits: number
}) {
  const router = useRouter()
  const { status, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  // Protect the route: send unauthenticated users to the login page.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login")
  }, [status, router])

  // While restoring the session (or redirecting), show a loader.
  if (status !== "authenticated") {
    return (
      <main className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-salad" />
        <span className="sr-only">Loading</span>
      </main>
    )
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        tenant={tenant}
        credits={credits}
        onLogout={logout}
      />
      <ChatMain signedIn />
    </main>
  )
}
