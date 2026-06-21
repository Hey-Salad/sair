import { headers } from "next/headers"
import { DashboardShell } from "@/components/dashboard-shell"
import { LandingPage } from "@/components/marketing/landing-page"
import { WorkspacePicker } from "@/components/app/workspace-picker"
import { getAuthContext } from "@/lib/auth-context"
import { getCreditBalance } from "@/lib/credits"
import { getHostType, getTenantFromHost } from "@/lib/tenant"

export default async function Page() {
  const host = (await headers()).get("x-tenant-host")
  const hostType = getHostType(host)

  // heysalad.io / www  -> marketing landing page
  if (hostType === "marketing") {
    return <LandingPage />
  }

  // app.heysalad.io  -> login + workspace picker (auth-gated client-side)
  if (hostType === "app") {
    return <WorkspacePicker />
  }

  // <slug>.heysalad.io or custom domain -> the tenant workspace dashboard
  const tenant = await getTenantFromHost(host)
  const ctx = await getAuthContext()
  const activeTenant = ctx?.tenant ?? tenant
  const credits = activeTenant ? (await getCreditBalance(activeTenant.id)).balance : 0

  return <DashboardShell tenant={activeTenant} credits={credits} />
}
