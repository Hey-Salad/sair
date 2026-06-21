import { NextResponse } from "next/server"
import { getHeySaladUser } from "@/lib/auth"
import { createWorkspace, isSlugAvailable, normalizeSlug } from "@/lib/provisioning"

// GET /api/workspaces?slug=acme-bistro  -> { slug, available }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get("slug") ?? ""
  const slug = normalizeSlug(raw)
  const available = await isSlugAvailable(slug)
  return NextResponse.json({ slug, available })
}

// POST /api/workspaces  { name, slug, plan? }  -> creates a tenant + subdomain
export async function POST(request: Request) {
  const user = await getHeySaladUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { name?: string; slug?: string; plan?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name || !body.slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 })
  }

  try {
    const tenant = await createWorkspace({
      name,
      slug: body.slug,
      plan: body.plan as never,
      ownerUserId: user.id,
    })
    return NextResponse.json({ tenant }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create workspace"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
