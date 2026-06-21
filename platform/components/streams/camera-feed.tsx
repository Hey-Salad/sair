"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Video,
  VideoOff,
  Eye,
  Scan,
  Sun,
  Camera as CameraIcon,
  Wifi,
  WifiOff,
  Maximize2,
} from "lucide-react"

const WS_BASE = "wss://sally-ai-camera-api.heysalad.app"
const DETECT_URL = "https://sally-api.heysalad.app/api/vision/detect"

interface Detection {
  label: string
  score: number
  box: { xmin: number; ymin: number; xmax: number; ymax: number }
  source: "edge" | "browser"
}

interface CameraProps {
  camera: { id: string; name: string; location: string }
}

export function CameraFeed({ camera }: CameraProps) {
  const [connected, setConnected] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [fps, setFps] = useState(0)
  const [detections, setDetections] = useState<Detection[]>([])
  const [autoDetect, setAutoDetect] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [nightVision, setNightVision] = useState(false)
  const [resolution, setResolution] = useState("")
  const [dataSize, setDataSize] = useState("0 KB")

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const prevUrlRef = useRef<string | null>(null)
  const fpsCountRef = useRef(0)
  const totalBytesRef = useRef(0)
  const frameCountRef = useRef(0)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animRef = useRef<number | null>(null)

  // FPS counter
  useEffect(() => {
    const iv = setInterval(() => {
      setFps(fpsCountRef.current)
      fpsCountRef.current = 0
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Bounding box render loop
  const drawBoxes = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.naturalWidth) {
      animRef.current = requestAnimationFrame(drawBoxes)
      return
    }

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const det of detections) {
      const { xmin, ymin, xmax, ymax } = det.box
      const isEdge = det.source === "edge"
      const color = isEdge ? "245,158,11" : "139,92,246"

      // Box
      ctx.strokeStyle = `rgba(${color},0.9)`
      ctx.lineWidth = 2
      ctx.strokeRect(xmin, ymin, xmax - xmin, ymax - ymin)

      // Fill
      ctx.fillStyle = `rgba(${color},0.08)`
      ctx.fillRect(xmin, ymin, xmax - xmin, ymax - ymin)

      // Label
      const label = `${det.label} ${Math.round(det.score * 100)}% ${isEdge ? "[E]" : "[B]"}`
      ctx.font = "bold 11px -apple-system, sans-serif"
      const tw = ctx.measureText(label).width + 8
      const lh = 16
      const ly = Math.max(0, ymin - lh - 2)
      ctx.fillStyle = `rgba(${color},0.9)`
      ctx.beginPath()
      ctx.roundRect(xmin, ly, tw, lh, 3)
      ctx.fill()
      ctx.fillStyle = "rgba(255,255,255,1)"
      ctx.fillText(label, xmin + 4, ly + 12)

      // Corner accents
      const cl = Math.min(12, (xmax - xmin) * 0.2)
      ctx.strokeStyle = `rgba(${color},1)`
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(xmin, ymin + cl); ctx.lineTo(xmin, ymin); ctx.lineTo(xmin + cl, ymin); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(xmax - cl, ymin); ctx.lineTo(xmax, ymin); ctx.lineTo(xmax, ymin + cl); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(xmin, ymax - cl); ctx.lineTo(xmin, ymax); ctx.lineTo(xmin + cl, ymax); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(xmax - cl, ymax); ctx.lineTo(xmax, ymax); ctx.lineTo(xmax, ymax - cl); ctx.stroke()
    }

    animRef.current = requestAnimationFrame(drawBoxes)
  }, [detections])

  useEffect(() => {
    animRef.current = requestAnimationFrame(drawBoxes)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [drawBoxes])

  const connect = useCallback(() => {
    const url = `${WS_BASE}/stream/${camera.id}?role=viewer`
    const ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const blob = new Blob([e.data], { type: "image/jpeg" })
        blobRef.current = blob
        const newUrl = URL.createObjectURL(blob)
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
        prevUrlRef.current = newUrl

        if (imgRef.current) {
          imgRef.current.src = newUrl

          imgRef.current.onload = function () {
            const w = imgRef.current?.naturalWidth ?? 0
            const h = imgRef.current?.naturalHeight ?? 0
            if (w && h) setResolution(`${w}×${h}`)
          }
        }

        frameCountRef.current++
        fpsCountRef.current++
        totalBytesRef.current += e.data.byteLength
        setFrameCount(frameCountRef.current)

        const total = totalBytesRef.current
        setDataSize(
          total > 1048576
            ? `${(total / 1048576).toFixed(1)} MB`
            : `${(total / 1024).toFixed(0)} KB`
        )
        return
      }

      try {
        const msg = JSON.parse(e.data)
        if (msg.type === "edge_detections") {
          const filtered = (msg.detections || [])
            .filter((d: Detection) => d.score >= 0.25)
            .map((d: Detection) => ({ ...d, source: "edge" as const }))
          setDetections((prev) => [
            ...prev.filter((p) => p.source !== "edge"),
            ...filtered,
          ])
        }
      } catch {}
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }

    ws.onerror = () => setConnected(false)
  }, [camera.id])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnected(false)
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }
    setAutoDetect(false)
  }, [])

  const detectOnce = useCallback(async () => {
    if (detecting || !blobRef.current) return
    setDetecting(true)
    try {
      const res = await fetch(DETECT_URL, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blobRef.current,
      })
      const json = await res.json()
      if (json.ok) {
        const filtered = (json.detections || [])
          .filter((d: Detection) => d.score >= 0.25)
          .map((d: Detection) => ({ ...d, source: "browser" as const }))
        setDetections((prev) => [
          ...prev.filter((p) => p.source !== "browser"),
          ...filtered,
        ])
      }
    } catch {}
    setDetecting(false)
  }, [detecting])

  const toggleAutoDetect = useCallback(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
      setAutoDetect(false)
    } else {
      detectOnce()
      autoTimerRef.current = setInterval(() => {
        if (blobRef.current) detectOnce()
      }, 5000)
      setAutoDetect(true)
    }
  }, [detectOnce])

  const toggleNightVision = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    const next = !nightVision
    wsRef.current.send(JSON.stringify({ type: "night_vision", enabled: next }))
    setNightVision(next)
  }, [nightVision])

  const takeSnapshot = useCallback(() => {
    if (!imgRef.current?.src) return
    const a = document.createElement("a")
    a.href = imgRef.current.src
    a.download = `sally-${camera.id}-${Date.now()}.jpg`
    a.click()
  }, [camera.id])

  // Cleanup
  useEffect(() => {
    return () => {
      disconnect()
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    }
  }, [disconnect])

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Feed */}
      <div className="relative aspect-[4/3] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt={`${camera.name} feed`}
          className={`size-full object-contain ${connected ? "block" : "hidden"}`}
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 size-full"
        />
        {!connected && (
          <div className="flex size-full items-center justify-center text-sm text-zinc-500">
            <VideoOff className="mr-2 size-5" />
            Offline — tap Connect
          </div>
        )}

        {/* Overlay top */}
        {connected && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 py-2 text-xs text-white">
            <span className="font-semibold">{camera.name}</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase animate-pulse">
                Live
              </span>
              <span>{fps} fps</span>
            </div>
          </div>
        )}

        {/* Overlay bottom */}
        {connected && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[11px] text-zinc-400">
            <span>{resolution}</span>
            <span>{dataSize}</span>
          </div>
        )}

        {/* Detection badges */}
        {detections.length > 0 && (
          <div className="absolute right-2 top-10 z-10 flex flex-col gap-1">
            {detections.filter((d) => d.source === "edge").length > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-black">
                {detections.filter((d) => d.source === "edge").length} edge
              </span>
            )}
            {detections.filter((d) => d.source === "browser").length > 0 && (
              <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {detections.filter((d) => d.source === "browser").length} browser
              </span>
            )}
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi className="size-4 text-green-500" />
          ) : (
            <WifiOff className="size-4 text-zinc-500" />
          )}
          <span className="text-sm font-medium text-foreground">{camera.name}</span>
          <span className="text-xs text-muted-foreground">{camera.location}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <span>{frameCount} frames</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={connected ? disconnect : connect}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            connected
              ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              : "bg-red-500 text-white hover:bg-red-600"
          }`}
        >
          <Video className="size-3.5" />
          {connected ? "Disconnect" : "Connect"}
        </button>

        <button
          type="button"
          onClick={detectOnce}
          disabled={!connected || detecting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
        >
          <Scan className="size-3.5" />
          {detecting ? "Detecting..." : "Detect"}
        </button>

        <button
          type="button"
          onClick={toggleAutoDetect}
          disabled={!connected}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            autoDetect
              ? "bg-green-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <Eye className="size-3.5" />
          Auto {autoDetect ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          onClick={toggleNightVision}
          disabled={!connected}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            nightVision
              ? "bg-green-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          <Sun className="size-3.5" />
          Night
        </button>

        <button
          type="button"
          onClick={takeSnapshot}
          disabled={!connected}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40"
        >
          <CameraIcon className="size-3.5" />
          Snap
        </button>
      </div>

      {/* Detection tags */}
      {detections.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2">
          {detections.map((d, i) => (
            <span
              key={`${d.label}-${d.source}-${i}`}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                d.source === "edge"
                  ? "border border-amber-800 bg-amber-950 text-amber-300"
                  : "border border-violet-800 bg-violet-950 text-violet-300"
              }`}
            >
              {d.label}{" "}
              <span className="opacity-70">{Math.round(d.score * 100)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
