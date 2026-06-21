import { Phone, Mic2, MessageCircle, CreditCard, Boxes, Globe } from "lucide-react"

const INTEGRATIONS = [
  { icon: Mic2, name: "ElevenLabs" },
  { icon: Phone, name: "Twilio" },
  { icon: MessageCircle, name: "Slack" },
  { icon: CreditCard, name: "Stripe" },
  { icon: Boxes, name: "POS systems" },
  { icon: Globe, name: "Your own APIs" },
]

export function Integrations() {
  return (
    <section id="integrations" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-salad">Connect your stack</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Bring your own tools, on every workspace
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Each business connects its own accounts. HeySalad turns them into agent tools, so your
            copilot can call, message, and transact on your behalf.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {INTEGRATIONS.map((i) => (
            <div
              key={i.name}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-4 py-8"
            >
              <i.icon className="size-7 text-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{i.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
