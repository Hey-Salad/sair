// Credit ledger + usage metering.
//
// Model: ONE universal credit unit. Each feature has an internal conversion
// rate, so customer-facing pricing stays simple while costs vary by action.
// The ledger is append-only — balance = sum(amount). Every billable agent
// action records a usage_event AND a matching negative ledger entry.

import { isDbConfigured, query } from "@/lib/db/client"
import type { CreditBalance, UsageEvent, UsageFeature } from "@/lib/types"

// Internal cost rates (credits per unit). Tune these to your real model costs.
export const CREDIT_RATES: Record<UsageFeature, { perUnit: number; unit: string }> = {
  chat: { perUnit: 1, unit: "1k tokens" },
  codey: { perUnit: 2, unit: "1k tokens" },
  research: { perUnit: 10, unit: "session step" },
  image: { perUnit: 5, unit: "image" },
  voice: { perUnit: 8, unit: "minute" },
  sms: { perUnit: 3, unit: "message" },
}

export function creditsForUsage(feature: UsageFeature, units: number): number {
  const rate = CREDIT_RATES[feature]?.perUnit ?? 1
  return Math.ceil(units * rate)
}

const DEMO_BALANCE = 12_500

/** Current credit balance for a tenant. */
export async function getCreditBalance(tenantId: string): Promise<CreditBalance> {
  if (!isDbConfigured()) {
    return { tenantId, balance: DEMO_BALANCE, monthlyGrant: 25_000 }
  }

  const [bal] = await query<{ balance: string }>(
    `select coalesce(sum(amount), 0)::bigint as balance
       from credit_ledger where tenant_id = $1`,
    [tenantId],
  )
  const [sub] = await query<{ grant: string }>(
    `select coalesce(monthly_credit_grant, 0)::bigint as grant
       from subscriptions where tenant_id = $1`,
    [tenantId],
  )
  return {
    tenantId,
    balance: Number(bal?.balance ?? 0),
    monthlyGrant: Number(sub?.grant ?? 0),
  }
}

/**
 * Record a billable action: writes a usage_event and debits the ledger.
 * Returns the credits charged. Throws if the tenant has insufficient balance.
 */
export async function recordUsage(event: UsageEvent): Promise<number> {
  const charged = event.creditsCharged || creditsForUsage(event.feature, event.units)

  if (!isDbConfigured()) return charged // demo mode: no-op debit

  const { balance } = await getCreditBalance(event.tenantId)
  if (balance < charged) {
    throw new InsufficientCreditsError(event.tenantId, balance, charged)
  }

  const [usage] = await query<{ id: string }>(
    `insert into usage_events (tenant_id, user_id, feature, units, credits_charged, metadata)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [event.tenantId, event.userId, event.feature, event.units, charged, event.metadata ?? {}],
  )
  await query(
    `insert into credit_ledger (tenant_id, amount, reason, usage_event_id, metadata)
     values ($1, $2, 'usage', $3, $4)`,
    [event.tenantId, -charged, usage?.id ?? null, { feature: event.feature }],
  )
  return charged
}

/** Grant credits (monthly cycle, top-up, refund, manual adjustment). */
export async function grantCredits(
  tenantId: string,
  amount: number,
  reason: "monthly_grant" | "topup" | "refund" | "adjustment",
): Promise<void> {
  if (!isDbConfigured()) return
  await query(
    `insert into credit_ledger (tenant_id, amount, reason) values ($1, $2, $3)`,
    [tenantId, Math.abs(amount), reason],
  )
}

export class InsufficientCreditsError extends Error {
  constructor(
    public tenantId: string,
    public balance: number,
    public required: number,
  ) {
    super(`Insufficient credits: have ${balance}, need ${required}`)
    this.name = "InsufficientCreditsError"
  }
}
