# Sally Air — Global AI Hackathon with Qwen Cloud

**Track:** Track 5 — EdgeAgent

## Elevator pitch

Sally Air is a Qwen-powered EdgeAgent for commercial kitchens. An ESP32-S3
camera-and-sensor node **perceives** the room, **Qwen-VL on Alibaba Cloud
reasons** over the live frame plus air-quality readings, and the device **acts
locally** — driving exhaust fans, buzzers, and operator alerts — even when the
network drops.

## What it does

Commercial kitchens fail air-quality and fire-safety checks because nobody is
watching the room in real time. Sally Air puts a cheap edge node on the wall
that continuously watches and *reasons*:

- **Perceive (edge):** ESP32-S3 (DFR1154 + OV3660) streams JPEG frames at 10 FPS
  and PM2.5 / PM10 / CO2 / temperature / humidity readings over a TLS WebSocket
  through a Cloudflare Worker relay.
- **Reason (cloud):** `POST /api/vision/reason` sends the frame + readings to
  **Qwen-VL max on Alibaba Cloud Model Studio**, which fuses vision (smoke,
  unattended flames, grease build-up, blocked vents, crowding) with the sensor
  numbers and returns a strict-JSON safety directive.
- **Act (local):** the device receives a compact `EdgeDirective`
  (`severity` + `actions[]`) and turns on the exhaust fan, sounds the buzzer,
  sets the LED colour, and alerts the operator.
- **Degrade gracefully:** if Alibaba Cloud is unreachable or slow, a
  deterministic on-metrics heuristic keeps the device safe offline.

## How Qwen / Alibaba Cloud is used

| Concern | Implementation |
|---|---|
| Cloud reasoning model | **Qwen-VL max** (vision) + **Qwen-plus** (text) on **Alibaba Cloud Model Studio / DashScope** |
| Integration | OpenAI-compatible endpoint via `fetch`, no provider SDK |
| Proof file (client) | [`platform/lib/qwen/client.ts`](platform/lib/qwen/client.ts) |
| Proof file (EdgeAgent endpoint) | [`platform/app/api/vision/reason/route.ts`](platform/app/api/vision/reason/route.ts) |
| Endpoint | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |

## Repo map

```
sair/
├── firmware/        ESP32-S3 camera + sensor firmware (PlatformIO)
├── platform/        Next.js 16 — Eve AI workspace + Qwen EdgeAgent endpoint
│   ├── lib/qwen/client.ts                  ← Alibaba Cloud proof
│   └── app/api/vision/reason/route.ts      ← perceive→reason→act loop
├── mobile/          React Native (Expo) — live AQI gauges + alerts
├── camera-viewer/   Standalone live feed with AI vision overlay
└── codeplain/       Plain-language ops agents (menu kiosk + stock reorder)
```

## Try the reasoning endpoint

```bash
cd platform
cp .env.example .env.local          # add your Alibaba Cloud DASHSCOPE_API_KEY
pnpm install && pnpm dev

curl -X POST http://localhost:3000/api/vision/reason \
  -H 'Content-Type: application/json' \
  -d '{
    "deviceId": "kitchen-01",
    "frame": "https://<a-public-jpeg-frame-url>.jpg",
    "readings": { "pm25": 82, "co2": 1350, "temperatureC": 34, "humidity": 61 }
  }'
```

Returns e.g.:

```json
{
  "deviceId": "kitchen-01",
  "directive": {
    "severity": "alert",
    "summary": "Visible haze near the fryer with elevated PM2.5 and CO2.",
    "hazards": ["haze near fryer", "PM2.5 unhealthy", "CO2 elevated"],
    "actions": ["exhaust_fan_on", "led_amber", "notify_operator"],
    "source": "qwen-vl-alibaba-cloud"
  },
  "model": "qwen-vl-max"
}
```

## Links (fill in before submitting)

- **Public repo:** https://github.com/Hey-Salad/sair
- **Architecture diagram:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Demo video (≈3 min, public):** _<YouTube/Vimeo URL>_
- **Alibaba Cloud proof:** [`platform/lib/qwen/client.ts`](platform/lib/qwen/client.ts)
- **License:** MIT ([LICENSE](LICENSE))
```
