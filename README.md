# Sally Air

**An end-to-end IoT air quality platform by HeySalad — from sensor firmware to mobile app to AI workspace.**

Sally Air is a full-stack system for monitoring, visualising, and acting on indoor air quality data in commercial kitchens and food venues. It combines custom ESP32 camera firmware, a React Native mobile app, a multi-tenant AI workspace, a live camera viewer, and plain-language AI agents — all built during a single hackathon weekend.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Sally Air                          │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ firmware │  mobile  │ platform │ camera-  │  codeplain  │
│          │          │          │ viewer   │             │
│ ESP32-S3 │ React    │ Next.js  │ Live     │ Plain-lang  │
│ Camera + │ Native   │ AI       │ feed +   │ AI agents   │
│ Sensors  │ Expo app │ Workspace│ AI vision│             │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

---

## Components

### `/firmware` — Sally Camera Firmware (ESP32-S3)

IoT device firmware for the DFRobot DFR1154 ESP32-S3 AI Camera module.

- **Camera**: OV3660 sensor, VGA streaming @ 10 FPS over WebSocket
- **Cloud-native device flow**: Auto-registration with Sally API, JWT heartbeat tokens
- **Connectivity**: WiFi with captive portal setup, optional SIM800L cellular
- **AI-ready**: 4MB flash partition reserved for YOLO11n edge inference
- **Night vision**: IR LED with PWM control
- **Audio**: PDM microphone + I2S speaker for voice commands

**Stack**: PlatformIO, Arduino framework, ArduinoJson, NimBLE, ESPAsyncWebServer

### `/mobile` — Sally Air Mobile App (React Native)

IoT air quality monitoring app with a dark-themed UI.

- **Dashboard**: Real-time AQI gauge, temperature, humidity, pressure, gas readings
- **Device management**: BLE-based device pairing and configuration
- **Live streaming**: WebSocket-connected live data from sensors
- **Charts**: Historical air quality trends and analytics
- **Map view**: Device locations with status indicators

**Stack**: Expo SDK, React Native, TypeScript, BLE integration

### `/platform` — Eve AI Workspace (Next.js)

Multi-tenant AI workspace for food businesses, built on Vercel for Platforms.

- **Multi-tenancy**: Tenant-scoped data with three-host routing (marketing / app / tenant subdomains)
- **AI chat**: ChatGPT-style interface powered by the Eve agent runtime
- **Auth**: HeySalad OAuth (Google, GitHub, Email OTP) with session management
- **Credits & billing**: Append-only credit ledger with usage metering
- **Custom domains**: Vercel domain provisioning with Cloudflare DNS integration
- **Marketing site**: Landing page, features, pricing, FAQ

**Stack**: Next.js 16, React 19, TypeScript, Tailwind v4, pnpm

### `/camera-viewer` — Sally Camera Live Viewer

Standalone HTML page for viewing live camera feeds with AI-powered analysis.

- **Live video**: WebSocket frame streaming with FPS/latency stats
- **Image enhancement**: Brightness, contrast, saturation controls with presets
- **AI Vision panel**: Object detection tags (browser-based + edge) with confidence scores
- **Night vision**: IR LED toggle for low-light environments

### `/codeplain` — Plain-Language AI Agents

Two AI agents for kitchen operations, built with [Codeplain](https://codeplain.org) — described entirely in plain English and compiled to working Python.

#### `menu_kiosk`
A menu kiosk CLI with optional ElevenLabs voice narration. Browse menu items by category, look up individual dishes, and hear descriptions read aloud via text-to-speech. Supports JSON output mode.

#### `reorder_agent`
A stock reorder decision agent for commercial kitchens. Reads a JSON stock report, identifies items with "low" or "critical" status, and outputs a reorder plan with urgency levels, reasoning, and suggested orders.

---

## Quick Start

### Mobile App
```bash
cd mobile
npm install
npx expo start
```

### Platform
```bash
cd platform
pnpm install
pnpm dev
```

### Firmware
```bash
cd firmware
# Open in VS Code with PlatformIO extension
# Build & upload to ESP32-S3
pio run -t upload
```

### Codeplain Agents
```bash
cd codeplain/reorder_agent
python dist/reorder_agent.py sample_stock_report.json
```

---

## Team

**HeySalad OÜ** — Tallinn, Estonia
Built with AI-assisted development using Claude, v0, Bilt, and Codeplain.

---

## License

MIT
