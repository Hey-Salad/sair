import {
  MessageSquare,
  Telescope,
  ImageIcon,
  Code2,
  CalendarCheck,
  Boxes,
} from "lucide-react"

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI chat & search",
    description:
      "A conversational copilot that knows your menus, suppliers, and history. Search every past chat instantly.",
  },
  {
    icon: Telescope,
    title: "Deep research",
    description:
      "Multi-step research on suppliers, market trends, and compliance, with sourced answers you can trust.",
  },
  {
    icon: ImageIcon,
    title: "Image generation",
    description:
      "Create menu photography, social posts, and promo art on brand, without a designer.",
  },
  {
    icon: Code2,
    title: "Codey",
    description:
      "A coding agent that builds internal tools, integrations, and automations for your operation.",
  },
  {
    icon: CalendarCheck,
    title: "Table & venue management",
    description:
      "Handle bookings, floor plans, and staff scheduling, with AI that confirms reservations for you.",
  },
  {
    icon: Boxes,
    title: "Stock management",
    description:
      "Track inventory, predict reorders, and trigger supplier orders before you run out.",
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-salad">Everything in one place</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            One workspace for your whole operation
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            HeySalad combines a powerful AI assistant with the tools food businesses actually
            need to run day to day.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-salad/40"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-secondary">
                <f.icon className="size-5 text-salad" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
