"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  fetchProfile,
  getOAuthStartUrl,
  sendEmailOtp,
  validateToken,
  verifyEmailOtp,
  type HeySaladProfile,
} from "@/lib/heysalad/api"
import { clearToken, getToken, isTokenExpired, setToken } from "@/lib/heysalad/token-storage"

type AuthStatus = "loading" | "authenticated" | "unauthenticated"

interface AuthContextValue {
  status: AuthStatus
  user: HeySaladProfile | null
  error: string | null
  /** Redirect to a social provider's OAuth start endpoint. */
  loginWithProvider: (provider: "google" | "github") => void
  /** Email OTP step 1. */
  requestEmailOtp: (email: string) => Promise<void>
  /** Email OTP step 2 — verifies, stores token, loads profile. */
  verifyEmailCode: (input: {
    email: string
    code: string
    firstName?: string
    lastName?: string
  }) => Promise<void>
  /** Store a token received from the OAuth callback, then load the session. */
  completeTokenLogin: (token: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<HeySaladProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load and validate the session: validate token server-side, then fetch profile.
  const loadSession = useCallback(async () => {
    const token = getToken()
    if (!token || isTokenExpired(token)) {
      clearToken()
      setUser(null)
      setStatus("unauthenticated")
      return
    }
    try {
      await validateToken()
      const profile = await fetchProfile()
      setUser(profile)
      setStatus("authenticated")
      setError(null)
    } catch {
      // Token rejected/expired by the server — clear and require re-login.
      clearToken()
      setUser(null)
      setStatus("unauthenticated")
    }
  }, [])

  // On mount, attempt to restore the session.
  useEffect(() => {
    void loadSession()
  }, [loadSession])

  const loginWithProvider = useCallback((provider: "google" | "github") => {
    window.location.href = getOAuthStartUrl(provider)
  }, [])

  const requestEmailOtp = useCallback(async (email: string) => {
    setError(null)
    await sendEmailOtp(email)
  }, [])

  const verifyEmailCode = useCallback(
    async (input: { email: string; code: string; firstName?: string; lastName?: string }) => {
      setError(null)
      const { token } = await verifyEmailOtp(input)
      setToken(token)
      await loadSession()
    },
    [loadSession],
  )

  const completeTokenLogin = useCallback(
    async (token: string) => {
      setError(null)
      setToken(token)
      await loadSession()
    },
    [loadSession],
  )

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    setStatus("unauthenticated")
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      error,
      loginWithProvider,
      requestEmailOtp,
      verifyEmailCode,
      completeTokenLogin,
      logout,
    }),
    [status, user, error, loginWithProvider, requestEmailOtp, verifyEmailCode, completeTokenLogin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
  return ctx
}
