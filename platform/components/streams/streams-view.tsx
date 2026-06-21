"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { useAuth } from "@/components/auth/auth-provider"
import { CameraFeed } from "@/components/streams/camera-feed"

const CAMERAS = [
  { id: "ACA70429C3B4", name: "Sally Cam 1", location: "Kitchen" },
  { id: "SALLY-CAM-002", name: "Sally Cam 2", location: "Fridge" },
]

export function StreamsView() {
  const router = useRouter()
  const { status } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  if (status === "unauthenticated") {
    // Allow access without auth for demo/hackathon
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        tenant={null}
        credits={0}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Streams</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live camera feeds with AI object detection (DETR ResNet-50)
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {CAMERAS.map((cam) => (
              <CameraFeed key={cam.id} camera={cam} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
