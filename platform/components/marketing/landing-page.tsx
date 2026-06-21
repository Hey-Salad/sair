import { SiteHeader } from "@/components/marketing/site-header"
import { Hero } from "@/components/marketing/hero"
import { Features } from "@/components/marketing/features"
import { Integrations } from "@/components/marketing/integrations"
import { Pricing } from "@/components/marketing/pricing"
import { Faq } from "@/components/marketing/faq"
import { CtaFooter } from "@/components/marketing/cta-footer"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <Integrations />
        <Pricing />
        <Faq />
        <CtaFooter />
      </main>
    </div>
  )
}
