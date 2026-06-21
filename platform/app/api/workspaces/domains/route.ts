import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth-context"
import { addCustomDomain, refreshCustomDomain, removeCustomDomain } from "@/lib/provisioning"

// All operations act on the CURRENT tenant (resolved from the request host) and
// require an owner/admin of that tenant.
async function requireManager() {
  const ctx = await getAuthContext()
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ctx }
}

// POST /api/workspaces/domains  { domain }  -> attach custom domain + DNS instructions
export async function POST(request: Request) {
  const { ctx, error } = await requireManager()
  if (error) return error

  let body: { domain?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.domain) return NextResponse.json({ error: "domain is required" }, { status: 400 })

  try {
    const result = await addCustomDomain(ctx!.tenant.id, body.domain)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add domain"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// PATCH /api/workspaces/domains  { domain }  -> re-check verification status
export async function PATCH(request: Request) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { domain?: string }
  if (!body.domain) return NextResponse.json({ error: "domain is required" }, { status: 400 })

  const result = await refreshCustomDomain(ctx!.tenant.id, body.domain)
  return NextResponse.json(result)
}

// DELETE /api/workspaces/domains  { domain }  -> disconnect custom domain
export async function DELETE(request: Request) {
  const { ctx, error } = await requireManager()
  if (error) return error

  const body = (await request.json().catch(() => ({}))) as { domain?: string }
  if (!body.domain) return NextResponse.json({ error: "domain is required" }, { status: 400 })

  await removeCustomDomain(ctx!.tenant.id, body.domain)
  return NextResponse.json({ ok: true })
}
