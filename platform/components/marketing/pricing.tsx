import { Check } from "lucide-react"
import { appUrl } from "@/lib/urls"

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    description: "For solo operators trying out HeySalad.",
    credits: "500 credits / month",
    features: ["AI chat & search", "Image generation", "1 workspace", "Community support"],
    cta: "Start for free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/mo",
    description: "For growing restaurants and venues.",
    credits: "10,000 credits / month",
    features: [
      "Everything in Starter",
      "Deep research & Codey",
      "Table & stock management",
      "Custom integrations",
      "Priority support",
    ],
    cta: "Start Pro trial",
    featured: true,
  },
  {
    name: "Business",
    price: "Custom",
    period: "",
    description: "For multi-site groups and franchises.",
    credits: "Volume credits + pooling",
    features: [
      "Everything in Pro",
      "Custom domain per venue",
      "SSO & team roles",
      "Dedicated success manager",
      "SLA & onboarding",
    ],
    cta: "Talk to sales",
    featured: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-salad">Pricing</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Subscriptions plus credits that scale with you
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Pick a plan for your team, then spend credits as your agents work. Top up anytime, no
            surprise bills.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-7 ${
                plan.featured
                  ? "border-salad bg-card ring-1 ring-salad/40"
                  : "border-border bg-card"
              }`}
            >
              {plan.featured && (
                <span className="mb-4 inline-flex w-fit items-center rounded-full bg-salad px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-card-foreground">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight text-card-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-4 text-sm font-medium text-salad">{plan.credits}</p>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-[15px] text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-salad" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={appUrl()}
                className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 ${
                  plan.featured
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-secondary text-foreground"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
