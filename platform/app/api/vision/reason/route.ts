// ─────────────────────────────────────────────────────────────────────────────
//  EdgeAgent reasoning endpoint  —  Sally Air
// ─────────────────────────────────────────────────────────────────────────────
//
//  Track 5 (EdgeAgent) core loop:
//    PERCEIVE  (edge)   ESP32-S3 camera frame + PM/CO2/temp/humidity sensors
//        │
//        ▼
//    REASON    (cloud)  Qwen-VL on Alibaba Cloud Model Studio  ← this endpoint
//        │
//        ▼
//    ACT       (local)  structured directive returned to the edge device
//                       (exhaust fan, buzzer, LED, operator alert)
//
//  Design notes for judging:
//   • Edge–cloud orchestration: the device sends a compact frame + readings and
//     receives a small structured directive — bandwidth-aware, latency-bounded.
//   • Privacy-aware: frames are reasoned over in-flight and never persisted here.
//   • Graceful degradation: if Alibaba Cloud is unreachable / slow / no key,
//     a deterministic on-metrics heuristic keeps the device safe offline.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server"
import { qwenVisionReason, QwenError } from "@/lib/qwen/client"

export const runtime = "nodejs"
export const maxDuration = 30

interface SensorReadings {
  pm25?: number // µg/m³
  pm10?: number // µg/m³
  co2?: number // ppm
  temperatureC?: number
  humidity?: number // %
}

interface ReasonRequest {
  deviceId: string
  /** data: URL or public https URL of the latest JPEG frame from the edge camera. */
  frame?: string
  readings?: SensorReadings
}

type Severity = "ok" | "watch" | "alert" | "critical"

interface EdgeDirective {
  severity: Severity
  summary: string
  hazards: string[]
  /** Local actions the ESP32 should take right now. */
  actions: Array<"exhaust_fan_on" | "buzzer" | "led_red" | "led_amber" | "notify_operator" | "none">
  source: "qwen-vl-alibaba-cloud" | "edge-fallback"
}

const VISION_INSTRUCTION = `You are the on-site air-quality safety agent for a commercial kitchen.
You are given ONE camera frame plus live air-quality sensor readings.
Assess the scene for hazards: visible smoke/steam/haze, unattended flames, grease
build-up, blocked vents, overcrowding, or anything inconsistent with the readings.
Return STRICT JSON only, matching:
{
  "severity": "ok" | "watch" | "alert" | "critical",
  "summary": "one sentence for the operator",
  "hazards": ["short phrase", ...],
  "actions": ["exhaust_fan_on" | "buzzer" | "led_red" | "led_amber" | "notify_operator" | "none", ...]
}
Escalate severity when the frame and readings agree on a hazard. Keep it terse.`

/** Deterministic offline safety net — runs when Alibaba Cloud is unreachable. */
function edgeFallback(readings?: SensorReadings): EdgeDirective {
  const pm25 = readings?.pm25 ?? 0
  const co2 = readings?.co2 ?? 0
  let severity: Severity = "ok"
  const hazards: string[] = []
  const actions: EdgeDirective["actions"] = []

  if (pm25 >= 150 || co2 >= 2000) {
    severity = "critical"
    hazards.push(pm25 >= 150 ? "PM2.5 hazardous" : "CO2 dangerous")
    actions.push("exhaust_fan_on", "buzzer", "led_red", "notify_operator")
  } else if (pm25 >= 55 || co2 >= 1200) {
    severity = "alert"
    hazards.push(pm25 >= 55 ? "PM2.5 unhealthy" : "CO2 elevated")
    actions.push("exhaust_fan_on", "led_amber", "notify_operator")
  } else if (pm25 >= 35 || co2 >= 1000) {
    severity = "watch"
    hazards.push("air quality declining")
    actions.push("led_amber")
  } else {
    actions.push("none")
  }

  return {
    severity,
    summary:
      severity === "ok"
        ? "Air quality normal (offline heuristic — cloud reasoning unavailable)."
        : `Offline heuristic engaged: ${hazards.join(", ")}.`,
    hazards,
    actions,
    source: "edge-fallback",
  }
}

function safeParse(text: string): Partial<EdgeDirective> | null {
  try {
    return JSON.parse(text)
  } catch {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0])
    } catch {
      return null
    }
  }
}

export async function POST(req: NextRequest) {
  let body: ReasonRequest
  try {
    body = (await req.json()) as ReasonRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
  }

  const readingsBlock = body.readings
    ? `Live sensor readings: ${JSON.stringify(body.readings)}`
    : "No sensor readings provided."

  // No frame → text-only path still gives the device a directive from readings.
  if (!body.frame) {
    return NextResponse.json({
      deviceId: body.deviceId,
      directive: edgeFallback(body.readings),
      note: "No frame supplied; returned metrics-only directive.",
    })
  }

  try {
    const result = await qwenVisionReason(
      body.frame,
      `${VISION_INSTRUCTION}\n\n${readingsBlock}`,
      { jsonMode: true, timeoutMs: 18_000 },
    )

    const parsed = safeParse(result.text)
    if (!parsed || !parsed.severity) {
      // Cloud responded but unusably — fail safe to the edge heuristic.
      return NextResponse.json({
        deviceId: body.deviceId,
        directive: edgeFallback(body.readings),
        note: "Qwen response unparseable; used edge fallback.",
      })
    }

    const directive: EdgeDirective = {
      severity: parsed.severity,
      summary: parsed.summary ?? "",
      hazards: parsed.hazards ?? [],
      actions: parsed.actions?.length ? parsed.actions : ["none"],
      source: "qwen-vl-alibaba-cloud",
    }

    return NextResponse.json({
      deviceId: body.deviceId,
      directive,
      model: result.model,
      usage: result.usage,
    })
  } catch (err) {
    // Alibaba Cloud unreachable / timed out / no key → graceful degradation.
    const status = err instanceof QwenError ? err.status : 502
    return NextResponse.json({
      deviceId: body.deviceId,
      directive: edgeFallback(body.readings),
      note: `Cloud reasoning unavailable (${status}); edge fallback engaged.`,
    })
  }
}
