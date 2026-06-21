"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"

export function CallbackHandler() {
  const router = useRouter()
  const params = useSearchParams()
  const { completeTokenLogin } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const token = params.get("token")
    const oauthError = params.get("error")

    if (oauthError) {
      setError(oauthError)
      return
    }
    if (!token) {
      setError("No sign-in token was provided.")
      return
    }

    completeTokenLogin(token)
      .then(() => router.replace("/"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.")
      })
  }, [params, completeTokenLogin, router])

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      {error ? (
        <>
          <AlertCircle className="size-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Sign-in failed</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground text-pretty">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-6 rounded-full bg-primary px-7 py-2.5 text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-salad" />
          <p className="mt-4 text-[15px] text-muted-foreground">Signing you in…</p>
        </>
      )}
    </div>
  )
}
