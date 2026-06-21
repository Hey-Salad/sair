# SAIR — Sally Air

**Full-stack IoT air quality + camera platform by HeySalad. From ESP32 firmware to mobile app to AI workspace — built in a single hackathon weekend.**

Sally Air is an end-to-end system for monitoring indoor air quality and camera feeds in commercial kitchens and food venues. A sensor camera streams frames and PM readings to the cloud, a React Native app gives operators real-time AQI gauges, and a multi-tenant AI workspace lets food businesses chat with an agent about their environment.

---

## Monorepo Structure

```
sair/
├── mobile/         React Native (Expo) — IoT air quality monitor + device management
├── platform/       Next.js 16 — Eve AI workspace, Vercel for Platforms multi-tenant
├── firmware/       PlatformIO — ESP32-S3 camera + sensor firmware
├── camera-viewer/  Standalone HTML — live feed with AI vision overlay
└── codeplain/      Plain-language agents — menu kiosk + stock reorder (Codeplain)
```

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              SALLY AIR PLATFORM                                 │
└──────────────────────────────────────────────────────────────────────────────────┘

  HARDWARE                       CLOUD SERVICES                         CLIENTS
 ┌────────────────┐
 │  ESP32-S3      │
 │  DFR1154       │──┐
 │  + OV3660 Cam  │  │
 │  + IR LEDs     │  │  WebSocket (TLS)
 │  + PDM Mic     │  │  JPEG frames @ 10 FPS
 │  + I2S Speaker │  │
 └────────────────┘  │
                     │
                     ▼
        ┌──────────────────────┐     ┌──────────────────────┐
        │  Cloudflare Worker   │────▶│  Vercel              │
        │  sally-camera-stream │     │  heysalad-os         │
        │  WebSocket relay     │     │  /api/vision/ingest  │
        │  + snapshot API      │     │  heartbeat endpoint  │
        └──────────┬───────────┘     └──────────┬───────────┘
                   │                             │
                   │  frames + AQ data           │  heartbeat + status
                   ▼                             ▼
        ┌──────────────────────┐     ┌──────────────────────┐
        │  Cloudflare          │     │  Vercel              │
        │  Workers AI          │     │  Eve Platform        │
        │  DETR object detect  │     │  Next.js 16          │
        │  sally-api/vision    │     │  app.heysalad.io     │
        └──────────────────────┘     └──────────────────────┘
                                              │
        ┌──────────────────────┐              │
        │  Mobile App          │◀─────────────┘
        │  Sally Air (Expo)    │
        │  iOS + Android       │
        └──────────────────────┘

        ┌──────────────────────┐
        │  Camera Viewer       │
        │  live.html           │◀──── WebSocket viewer
        └──────────────────────┘
```

---

## Data Flow

```
 ┌───────────┐  JPEG + JSON    ┌─────────────┐  forward     ┌──────────────┐
 │  ESP32-S3 │ ──────────────▶ │  CF Worker   │ ──────────▶ │  Viewers     │
 │  Camera   │  WebSocket      │  sally-cam-  │  WebSocket   │  (mobile,    │
 │           │  10 FPS         │  stream      │              │   browser)   │
 └───────────┘                 └──────┬──────┘              └──────────────┘
                                      │
      ┌───────────────────────────────┘
      │  POST /api/vision/detect
      ▼
 ┌─────────────┐                ┌─────────────┐
 │  Workers AI │  detections    │  Vercel API  │
 │  DETR       │ ──────────────▶│  heartbeat   │
 │  object det │                │  + status    │
 └─────────────┘                └──────┬──────┘
                                       │
      ┌────────────────────────────────┘
      │  device status
      ▼
 ┌─────────────┐
 │  Eve        │  AI chat about
 │  Platform   │  environment &
 │             │  camera feeds
 └─────────────┘

 WebSocket Frame Message:
 { binary JPEG frame }

 Heartbeat Payload:
 {
   "device_id": "CCBA9716248C",
   "firmware_version": "2.1.0",
   "ip": "192.168.1.124",
   "rssi": -52,
   "wifi_ssid": "HeySalad-Kitchen",
   "frames_sent": 14832,
   "uptime_ms": 3600000
 }
```

---

## BLE Provisioning Flow

```
 ┌──────────────┐   1. BLE scan   ┌──────────────┐
 │  Mobile App  │ ──────────────▶ │  ESP32-S3    │
 │  Sally Air   │                 │  "Sally-XXX" │
 └──────┬───────┘                 └──────┬───────┘
        │                                │
        │  2. Connect + OTP verify       │
        │◀──────────────────────────────▶│
        │                                │
        │  3. Write WiFi config (JSON)   │
        │──────────────────────────────▶ │
        │   { ssid, password,            │
        │     heartbeat_url,             │
        │     heartbeat_token }          │
        │                                │
        │  4. Status notifications       │
        │◀────────────────────────────── │
        │   "wifi_connected"             │
        │   "cloud_registered"           │
        │   "streaming"                  │
        │                                │

 BLE Service UUID: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 WiFi Config Char: beb5483e-36e1-4688-b7f5-ea07361b26a8
 Status Char:      beb5483e-36e1-4688-b7f5-ea07361b26a9
```

---

## Hardware

```
 ┌──────────────────────────────────────────────┐
 │         DFRobot DFR1154 ESP32-S3             │
 │         16MB Flash · 8MB OPI PSRAM           │
 │                                              │
 │   GPIO 5  (XCLK)  ──────── OV3660 Camera    │
 │   GPIO 8  (SDA)   ──────── OV3660 I2C       │
 │   GPIO 9  (SCL)   ──────── OV3660 I2C       │
 │   GPIO 1  (VSYNC) ──────── OV3660 Sync      │
 │   GPIO 2  (HREF)  ──────── OV3660 Sync      │
 │   GPIO 15 (PCLK)  ──────── OV3660 Clock     │
 │   GPIO 4-21       ──────── OV3660 Data D0-D7│
 │                                              │
 │   GPIO 3          ──────── Recording LED     │
 │   GPIO 47         ──────── IR LEDs (night)   │
 │   GPIO 0          ──────── Button            │
 │                                              │
 │   GPIO 39         ──────── PDM Mic (data)    │
 │   GPIO 38         ──────── PDM Mic (clock)   │
 │   GPIO 45/46/42   ──────── I2S Speaker       │
 └──────────────────────────────────────────────┘

 Camera: OV3660 — VGA 640×480 @ 10 FPS, JPEG encoding
 Night Vision: IR LED array, PWM controlled
 Audio: PDM microphone + I2S DAC speaker output
 Connectivity: WiFi 2.4GHz + BLE 5.0 (NimBLE)
```

---

## Multi-Tenant Platform Architecture (Eve)

```
                          ┌──────────────────────────────────┐
                          │         Incoming Request          │
                          └──────────────┬───────────────────┘
                                         │
                                    proxy.ts
                               tenant resolution
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
           ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
           │  heysalad.io │    │    app.      │    │  <slug>.     │
           │  Marketing   │    │ heysalad.io  │    │ heysalad.io  │
           │              │    │  Workspace   │    │   Tenant     │
           │  Landing     │    │  Picker +    │    │  Dashboard   │
           │  Features    │    │  Login       │    │  AI Chat     │
           │  Pricing     │    │              │    │  Settings    │
           │  FAQ         │    │              │    │  Domains     │
           └──────────────┘    └──────────────┘    └──────────────┘

 Auth:     HeySalad OAuth (Google, GitHub, Email OTP)
 Billing:  Append-only credit_ledger + usage_events metering
 Domains:  Vercel domain provisioning API + Cloudflare DNS
 Stack:    Next.js 16, React 19, Tailwind v4, TypeScript
```

---

## Codeplain Agents

Two kitchen operations agents written in **plain English** and compiled to Python using [Codeplain](https://codeplain.org).

```
 ┌──────────────────────────────────────────────────────────────┐
 │                    CODEPLAIN PIPELINE                        │
 │                                                              │
 │   .plain spec ──▶ codeplain compile ──▶ Python + tests       │
 │                                                              │
 │   menu_kiosk.plain ──▶ menu_kiosk.py                        │
 │     • Browse menu by category (Starter/Main/Drink)          │
 │     • Look up individual items with pricing                 │
 │     • ElevenLabs TTS narration (--narrate flag)             │
 │     • JSON output mode (--json flag)                        │
 │                                                              │
 │   reorder_agent.plain ──▶ reorder_agent.py                  │
 │     • Reads JSON stock report                               │
 │     • Flags "critical" items → urgency: high               │
 │     • Flags "low" items → urgency: medium                  │
 │     • Outputs reorder plan with reasoning                   │
 └──────────────────────────────────────────────────────────────┘
```

---

## Services & URLs

| Service | URL | Hosting |
|---------|-----|---------|
| Camera stream relay | sally-camera-stream.heysalad-o.workers.dev | Cloudflare Workers |
| Vision detect API | sally-api.heysalad.app/api/vision/detect | Cloudflare Workers AI |
| Heartbeat endpoint | heysalad-os.vercel.app/api/vision/ingest/heartbeat | Vercel |
| Eve AI workspace | app.heysalad.io | Vercel |
| Camera viewer | live.html (self-hosted) | Static HTML |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native, Expo, TypeScript, BLE |
| Platform | Next.js 16, React 19, Tailwind v4, TypeScript |
| Camera Relay | Cloudflare Workers (WebSocket) |
| AI Inference | Cloudflare Workers AI (DETR object detection) |
| Firmware | PlatformIO, Arduino, ESP32-S3, C++ |
| BLE | NimBLE (device), Web Bluetooth / react-native-ble-plx (app) |
| Auth | HeySalad OAuth (Google, GitHub, Email OTP) |
| Domains | Vercel for Platforms + Cloudflare DNS |
| Agents | Codeplain (plain English → Python) |
| TTS | ElevenLabs API (menu narration) |

---

## Quick Start

### Mobile App
```bash
cd mobile
npm install
npx expo start
# Scan QR with Expo Go
```

### Eve Platform
```bash
cd platform
pnpm install
pnpm dev
# http://localhost:3000
```

### Firmware
```bash
cd firmware
# Open in VS Code with PlatformIO extension
pio run -e dfrobot_dfr1154 -t upload
pio device monitor -b 115200
```

### Camera Viewer
```bash
open camera-viewer/live.html
# Enter device ID, connect via WebSocket
```

### Codeplain Agents
```bash
# Menu kiosk
cd codeplain/menu_kiosk
python plain_modules/menu_kiosk/menu_kiosk.py --menu
python plain_modules/menu_kiosk/menu_kiosk.py "Grain Bowl"
python plain_modules/menu_kiosk/menu_kiosk.py "Grain Bowl" --json

# Stock reorder
cd codeplain/reorder_agent
python plain_modules/reorder_agent/reorder_agent.py sample_stock_report.json
```

---

## AQ Levels

| Level | PM2.5 (µg/m³) | Color | Action |
|-------|---------------|-------|--------|
| Good | 0–12 | Green | None |
| Moderate | 12.1–35.4 | Yellow | Ventilate |
| Unhealthy | 35.5+ | Red | Alert operator |

---

## Built With

This project was built during a hackathon weekend using AI-assisted development:

- **Claude** (Anthropic) — architecture, firmware, platform code
- **v0** (Vercel) — Eve platform scaffold
- **Bilt** — mobile app scaffold
- **Codeplain** — plain-language agent compilation

---

## Team

**HeySalad Inc.** — Built in London

---

## License

MIT
