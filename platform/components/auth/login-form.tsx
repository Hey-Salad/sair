"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTheme } from "next-themes"
import { Mail, ArrowLeft, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

type Step = "options" | "email" | "code"

export function LoginForm() {
  const router = useRouter()
  const { status, loginWithProvider, requestEmailOtp, verifyEmailCode } = useAuth()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [step, setStep] = useState<Step>("options")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  // If already signed in, leave the login page.
  useEffect(() => {
    if (status === "authenticated") router.replace("/")
  }, [status, router])

  const logoSrc =
    mounted && resolvedTheme === "light" ? "/heysalad-logo-black.png" : "/heysalad-logo-white.png"

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await requestEmailOtp(email.trim())
      setStep("code")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyEmailCode({
        email: email.trim(),
        code: code.trim(),
      })
      router.replace("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-10 flex justify-center">
        <Image
          src={logoSrc || "/placeholder.svg"}
          alt="HeySalad"
          width={586}
          height={200}
          priority
          unoptimized
          className="h-12 w-auto object-contain"
        />
      </div>

      <h1 className="text-center text-2xl font-semibold text-foreground text-balance">
        Sign in to HeySalad
      </h1>
      <p className="mt-2 text-center text-[15px] leading-relaxed text-muted-foreground text-pretty">
        Your co-pilot for food management.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {step === "options" && (
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => loginWithProvider("google")}
            className="flex h-12 items-center justify-center gap-3 rounded-full border border-border bg-card text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <GoogleIcon className="size-5" />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => loginWithProvider("github")}
            className="flex h-12 items-center justify-center gap-3 rounded-full border border-border bg-card text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <GitHubIcon className="size-5" />
            Continue with GitHub
          </button>

          <div className="my-2 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => setStep("email")}
            className="flex h-12 items-center justify-center gap-3 rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Mail className="size-5" />
            Continue with email
          </button>
        </div>
      )}

      {step === "email" && (
        <form onSubmit={handleSendOtp} className="mt-8 flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              className="h-12 w-full rounded-lg border border-border bg-input px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Send code
          </button>
          <BackButton onClick={() => setStep("options")} />
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {"We sent a code to "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
          <Field label="Verification code">
            <input
              inputMode="numeric"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="h-12 w-full rounded-lg border border-border bg-input px-4 text-[15px] tracking-widest text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Verify and continue
          </button>
          <BackButton onClick={() => setStep("email")} />
        </form>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back
    </button>
  )
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.61 0 3.06.55 4.2 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"
      />
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.74 1.27 3.41.97.11-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}
