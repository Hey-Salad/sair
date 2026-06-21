// Thin database access layer.
//
// This is intentionally driver-agnostic. When you connect HeySalad's existing
// Postgres (or Neon / AWS Aurora) by setting DATABASE_URL, wire the real query
// implementation here. Until then, `isDbConfigured()` returns false and callers
// fall back to demo data so the app still runs in preview.
//
// To go live: install a driver (e.g. `pnpm add postgres`) and replace the body
// of `query()` with a real connection. Every query MUST stay scoped by tenant_id.

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export async function query<T = Record<string, unknown>>(
  _sql: string,
  _params: unknown[] = [],
): Promise<T[]> {
  if (!isDbConfigured()) {
    // No database connected yet — callers should handle the empty result
    // and provide demo data. See lib/tenant.ts and lib/credits.ts.
    return []
  }

  // TODO: replace with real driver once HeySalad DB credentials are available.
  // Example (postgres.js):
  //   const sql = postgres(process.env.DATABASE_URL!)
  //   return sql.unsafe(_sql, _params as never[]) as unknown as T[]
  throw new Error(
    "DATABASE_URL is set but no driver is wired up yet. Implement query() in lib/db/client.ts.",
  )
}
