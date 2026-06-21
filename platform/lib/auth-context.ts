// Combines the HeySalad user, the resolved tenant, and the user's role into a
// single AuthContext for server components / route handlers. This is the object
// every feature should use to scope data: always filter by ctx.tenant.id.

import { getHeySaladUser } from "@/lib/auth"
import { getCurrentTenant } from "@/lib/tenant"
import { isDbConfigured, query } from "@/lib/db/client"
import type { AuthContext, MemberRole } from "@/lib/types"

export async function getAuthContext(): Promise<AuthContext | null> {
  const [user, tenant] = await Promise.all([getHeySaladUser(), getCurrentTenant()])
  if (!user || !tenant) return null

  let role: MemberRole = "owner" // demo default

  if (isDbConfigured()) {
    const rows = await query<{ role: MemberRole }>(
      `select role from tenant_members where tenant_id = $1 and user_id = $2 limit 1`,
      [tenant.id, user.id],
    )
    if (!rows[0]) return null // user is not a member of this tenant
    role = rows[0].role
  }

  return { user, tenant, role }
}
