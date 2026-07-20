# Proof of Alibaba Cloud Deployment — Sally Air (Track 5: EdgeAgent)

Sally Air performs all cloud reasoning on **Qwen models hosted on Alibaba Cloud
Model Studio (DashScope)**. Every call runs through a single, auditable client.

## Where the Alibaba Cloud code lives

- **Client (single source of truth):**
  [`platform/lib/qwen/client.ts`](platform/lib/qwen/client.ts) — speaks the
  Alibaba Cloud Model Studio OpenAI-compatible REST API directly via `fetch`.
- **EdgeAgent reasoning endpoint:**
  [`platform/app/api/vision/reason/route.ts`](platform/app/api/vision/reason/route.ts)
  — perceive (edge frame + sensors) → **reason (Qwen-VL on Alibaba Cloud)** → act (local directive),
  with deterministic offline graceful degradation.
- **Standalone connectivity test:**
  [`platform/scripts/qwen-smoke-test.mjs`](platform/scripts/qwen-smoke-test.mjs)

## Deployment details

| Item | Value |
| --- | --- |
| Provider | Alibaba Cloud Model Studio (DashScope) |
| Workspace | HeySalad |
| Region | `ap-southeast-1` (Singapore) |
| OpenAI-compatible endpoint | `https://ws-3nwfmduaxiub8qp8.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` |
| Text model | `qwen-plus` |
| Vision model | `qwen-vl-max` |
| Auth | `Bearer <DASHSCOPE_API_KEY>` (key kept in git-ignored `.env.local`) |

## Verified live runs

### 1. Text reasoning — `qwen-plus`
```
Endpoint: https://ws-3nwfmduaxiub8qp8.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
✓ qwen-plus (1444ms): "Sally Air is connected to Alibaba Cloud."
  tokens: {"prompt_tokens":20,"completion_tokens":9,"total_tokens":29}
```

### 2. Full EdgeAgent loop — `qwen-vl-max` (vision over a camera frame)
Request: `POST /api/vision/reason` with an edge camera frame + live sensor readings
(`pm25:168, pm10:210, co2:1350, tempC:41`).

Response (live, from Alibaba Cloud):
```json
{
  "directive": {
    "severity": "critical",
    "summary": "Visible smoke and high particulate levels indicate a potential fire hazard.",
    "hazards": ["visible_smoke", "high_pm25", "high_pm10"],
    "actions": ["exhaust_fan_on", "buzzer", "led_red", "notify_operator"],
    "source": "qwen-vl-alibaba-cloud"
  },
  "model": "qwen-vl-max",
  "usage": { "total_tokens": 557, "prompt_tokens_details": { "image_tokens": 262, "text_tokens": 221 } }
}
```
The `image_tokens: 262` confirms Qwen-VL ingested and reasoned over the actual frame
on Alibaba Cloud — the model both saw visible smoke in the image and corroborated it
against the sensor readings before escalating to `critical`.

## Reproduce
```bash
cd platform
cp .env.example .env.local          # add your Model Studio DASHSCOPE_API_KEY + workspace base URL
node --env-file=.env.local scripts/qwen-smoke-test.mjs
```
