import { getAuthContext } from "@/lib/auth-context"
import { listDomains } from "@/lib/provisioning"
import { ROOT_DOMAIN } from "@/lib/tenant"
import { DomainManager } from "@/components/settings/domain-manager"

export const metadata = {
  title: "Domains · HeySalad",
}

export default async function DomainsSettingsPage() {
  const ctx = await getAuthContext()

  if (!ctx) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold text-foreground">Domains</h1>
        <p className="mt-2 text-muted-foreground">Sign in to manage your workspace domains.</p>
      </main>
    )
  }

  const domains = await listDomains(ctx.tenant)

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground text-balance">Domains</h1>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          Manage how customers reach <span className="text-foreground">{ctx.tenant.name}</span>. Use
          your free subdomain or connect your own custom domain.
        </p>
      </header>
      <DomainManager initialDomains={domains} rootDomain={ROOT_DOMAIN} />
    </main>
  )
}
