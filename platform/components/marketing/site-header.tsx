"use client"

import { useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Menu, X } from "lucide-react"
import { appUrl } from "@/lib/urls"

const NAV = [
  { label: "Features", href: "#features" },
  { label: "Integrations", href: "#integrations" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
]

export function SiteHeader() {
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const logoSrc = resolvedTheme === "light" ? "/heysalad-logo-black.png" : "/heysalad-logo-white.png"

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center" aria-label="HeySalad home">
          <Image
            src={logoSrc || "/placeholder.svg"}
            alt="HeySalad"
            width={586}
            height={200}
            priority
            unoptimized
            className="h-8 w-auto object-contain"
          />
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={appUrl()}
            className="text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            Sign in
          </a>
          <a
            href={appUrl()}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="rounded-md p-2 text-foreground md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <a
              href={appUrl()}
              className="mt-2 rounded-full bg-primary px-5 py-2.5 text-center text-sm font-medium text-primary-foreground"
            >
              Get started
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
