"use client"

import Image from "next/image"
import { useTheme } from "next-themes"
import { ArrowRight } from "lucide-react"
import { appUrl } from "@/lib/urls"

export function CtaFooter() {
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === "light" ? "/heysalad-logo-black.png" : "/heysalad-logo-white.png"

  return (
    <>
      <section className="border-t border-border/60 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ready to put your food business on autopilot?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Spin up your branded workspace in minutes. No credit card required to start.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={appUrl()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Get started free
              <ArrowRight className="size-4" />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border border-border bg-secondary/40 px-7 py-3 text-base font-medium text-foreground transition-colors hover:bg-secondary"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <Image
            src={logoSrc || "/placeholder.svg"}
            alt="HeySalad"
            width={586}
            height={200}
            unoptimized
            className="h-7 w-auto object-contain"
          />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {["Features", "Integrations", "Pricing", "FAQ"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} HeySalad. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
