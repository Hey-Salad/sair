import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { CallbackHandler } from "@/components/auth/callback-handler"

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Suspense
        fallback={
          <div className="flex flex-col items-center">
            <Loader2 className="size-8 animate-spin text-salad" />
            <p className="mt-4 text-[15px] text-muted-foreground">Signing you in…</p>
          </div>
        }
      >
        <CallbackHandler />
      </Suspense>
    </main>
  )
}
