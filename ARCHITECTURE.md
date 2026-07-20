# Sally Air — Architecture (EdgeAgent, Track 5)

Sally Air is an **EdgeAgent**: it **perceives** at the edge (ESP32-S3 camera +
air-quality sensors), **reasons** in the cloud (**Qwen-VL on Alibaba Cloud Model
Studio**), and **acts** locally (fans, buzzer, LEDs, operator alerts) — with a
deterministic on-device fallback when the network degrades.

## System diagram

```
        EDGE (perceive)                 CLOUD (reason)                  ACT
 ┌──────────────────────────┐   ┌──────────────────────────────┐
 │  ESP32-S3 (DFR1154)      │   │  Cloudflare Worker           │
 │  • OV3660 camera 10 FPS  │──▶│  sally-camera-stream         │
 │  • PM2.5 / PM10 / CO2    │   │  WebSocket (TLS) relay        │
 │  • temp / humidity        │   │  + snapshot API              │
 │  • IR LEDs, mic, speaker │   └───────────────┬──────────────┘
 └───────────▲──────────────┘                   │ frame + readings
             │                                   ▼
             │                    ┌──────────────────────────────┐
             │                    │  Vercel — Next.js 16          │
             │                    │  Eve Platform (app.heysalad)  │
             │  EdgeDirective     │  POST /api/vision/reason      │
             │  {severity,        │        │                      │
             │   actions[...]}    │        ▼                      │
             │                    │  lib/qwen/client.ts           │
             │                    │        │                      │
             │                    │        ▼                      │
             │                    │  ┌────────────────────────┐   │
             └────────────────────┼──│  ALIBABA CLOUD          │   │
                                  │  │  Model Studio (DashScope)│  │
                                  │  │  qwen-vl-max  (vision)  │   │
                                  │  │  qwen-plus    (text)    │   │
                                  │  └────────────────────────┘   │
                                  └──────────────────────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │  Mobile app (Expo) + kiosk    │
                                  │  live AQI gauges + alerts     │
                                  └──────────────────────────────┘
```

## The EdgeAgent loop

1. **Perceive** — the ESP32-S3 streams JPEG frames and PM/CO2/temp/humidity
   readings over a TLS WebSocket via a Cloudflare Worker relay.
2. **Reason** — `POST /api/vision/reason` sends the frame + readings to
   **Qwen-VL on Alibaba Cloud Model Studio** (`lib/qwen/client.ts`). Qwen fuses
   what it *sees* (smoke, flames, blocked vents, crowding) with what the sensors
   *measure* and returns a strict-JSON directive.
3. **Act** — the device receives a small `EdgeDirective`
   (`severity` + `actions[]`) and drives fans, buzzer, LEDs, and operator alerts.

## Why this is a real EdgeAgent (Track 5 criteria)

- **Edge–cloud orchestration under constraints** — the edge sends a compact
  frame + tiny JSON; the cloud returns a tiny directive. Requests are
  latency-bounded (`timeoutMs`) so the control loop never stalls.
- **Privacy-aware** — frames are reasoned over in-flight and **not persisted**
  by the reasoning endpoint.
- **Graceful degradation** — if Alibaba Cloud is unreachable, slow, or the key
  is missing, a deterministic metrics-only heuristic (`edgeFallback`) keeps the
  device safe offline, and the response records `source: "edge-fallback"`.

## Proof of Alibaba Cloud deployment

Every cloud-reasoning call runs through Qwen on Alibaba Cloud Model Studio:

- **`platform/lib/qwen/client.ts`** — the Alibaba Cloud (DashScope) client.
- **`platform/app/api/vision/reason/route.ts`** — the EdgeAgent endpoint that
  invokes Qwen-VL for every frame.
