import { ArrowRight, Mic, Plus } from "lucide-react"
import { appUrl } from "@/lib/urls"

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pt-20 pb-12 text-center sm:px-6 sm:pt-28 lg:px-8">
        <a
          href="#features"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="size-1.5 rounded-full bg-salad" />
          Your AI co-pilot for food management
        </a>

        <h1 className="mx-auto mt-8 max-w-4xl text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
          Run your food business with an AI that never clocks out
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          HeySalad gives restaurants, kitchens, and venues a single AI workspace to manage
          tables, stock, and research, generate content, and automate the busywork, all on your
          own branded space.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={appUrl()}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Start for free
            <ArrowRight className="size-4" />
          </a>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary/40 px-7 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
          >
            View pricing
          </a>
        </div>

        {/* Product preview */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-2 shadow-2xl">
            <div className="rounded-xl bg-background p-8 sm:p-14">
              <p className="text-2xl font-bold text-foreground sm:text-4xl">Ready when you are.</p>
              <div className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-full bg-secondary px-4 py-3">
                <Plus className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left text-[15px] text-muted-foreground">
                  Ask anything about your venue&hellip;
                </span>
                <Mic className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
                  <ArrowRight className="size-4 -rotate-90 text-primary-foreground" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
