"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

const FAQS = [
  {
    q: "What counts as a credit?",
    a: "Every agent action — a chat response, an image, a research step, a voice minute, or an SMS — consumes credits. Your plan includes a monthly allowance and you can top up anytime.",
  },
  {
    q: "Do I get my own branded space?",
    a: "Yes. Every business gets its own workspace at yourname.heysalad.io, and Pro and Business plans can connect a fully custom domain like app.yourrestaurant.com.",
  },
  {
    q: "Which integrations are supported?",
    a: "You can connect your own ElevenLabs, Twilio, Slack, Stripe, and POS accounts. HeySalad turns them into tools your AI copilot can use on your behalf.",
  },
  {
    q: "Is my data isolated from other businesses?",
    a: "Completely. Every workspace is fully tenant-isolated — your chats, bookings, stock, and integrations are never shared or used to train models.",
  },
  {
    q: "Can I invite my team?",
    a: "Yes. Invite staff with roles (owner, admin, staff) so everyone works in the same workspace with the right permissions.",
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-salad">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions, answered
          </h2>
        </div>

        <div className="mt-12 flex flex-col gap-3">
          {FAQS.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q} className="rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] font-medium text-card-foreground">{item.q}</span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="px-6 pb-5 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
