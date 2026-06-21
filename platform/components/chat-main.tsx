"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Plus, Mic, ArrowUp, ChevronDown, Sun, Moon } from "lucide-react"

export function ChatMain({
  signedIn = false,
}: {
  signedIn?: boolean
}) {
  const [value, setValue] = useState("")

  return (
    <section className="relative flex h-screen flex-1 flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center px-6 py-5">
        <div className="ml-auto flex items-center gap-4">
        {!signedIn && (
          <>
            <button
              type="button"
              className="rounded-full bg-primary px-7 py-2.5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
            <button
              type="button"
              className="text-[15px] text-foreground transition-colors hover:text-muted-foreground"
            >
              Register for free
            </button>
          </>
        )}
        <ThemeToggle />
        </div>
      </header>

      {/* Centered hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <h1 className="text-balance text-center text-5xl font-bold tracking-tight text-foreground md:text-6xl">
          Ready when you are.
        </h1>

        {/* Composer */}
        <div className="mt-10 w-full max-w-3xl">
          <div className="flex items-center gap-2 rounded-full bg-input px-3 py-2.5">
            <button
              type="button"
              aria-label="Add attachment"
              className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
            >
              <Plus className="size-5" />
            </button>

            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ask anything"
              className="flex-1 bg-transparent px-2 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />

            <button
              type="button"
              className="flex items-center gap-1 rounded-full px-3 py-2 text-[15px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Extended
              <ChevronDown className="size-4" />
            </button>

            <button
              type="button"
              aria-label="Voice input"
              className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
            >
              <Mic className="size-5" />
            </button>

            <button
              type="button"
              aria-label="Send message"
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = !mounted || resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative flex h-9 w-16 items-center rounded-full bg-secondary px-1"
    >
      <span className="flex flex-1 items-center justify-center">
        <Sun className="size-4 text-muted-foreground" />
      </span>
      <span className="flex flex-1 items-center justify-center">
        <Moon className="size-4 text-muted-foreground" />
      </span>
      <span
        className="absolute top-1 size-7 rounded-full bg-background shadow-sm transition-transform"
        style={{ transform: isDark ? "translateX(28px)" : "translateX(2px)" }}
      />
    </button>
  )
}
