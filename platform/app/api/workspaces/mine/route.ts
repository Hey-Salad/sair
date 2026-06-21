import { NextResponse } from "next/server"
import { getHeySaladUser } from "@/lib/auth"
import { getUserWorkspaces } from "@/lib/tenant"

// GET /api/workspaces/mine -> { workspaces: [...] } for the signed-in user.
export async function GET(request: Request) {
  const user = await getHeySaladUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workspaces = await getUserWorkspaces(user.id)
  return NextResponse.json({ workspaces })
}
