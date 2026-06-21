// Shared domain types for the HeySalad multi-tenant platform.

export type TenantPlan = "free" | "starter" | "pro" | "enterprise"
export type MemberRole = "owner" | "admin" | "staff"

export interface Tenant {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  plan: TenantPlan
  status: "active" | "suspended" | "trialing"
}

export interface HeySaladUser {
  id: string
  externalId: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface AuthContext {
  user: HeySaladUser
  tenant: Tenant
  role: MemberRole
}

// Billing
export type UsageFeature = "chat" | "image" | "research" | "codey" | "voice" | "sms"

export interface CreditBalance {
  tenantId: string
  balance: number
  monthlyGrant: number
}

export interface UsageEvent {
  tenantId: string
  userId: string | null
  feature: UsageFeature
  units: number
  creditsCharged: number
  metadata?: Record<string, unknown>
}
