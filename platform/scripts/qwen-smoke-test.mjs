// Zero-dependency smoke test for Qwen on Alibaba Cloud Model Studio (DashScope).
// Proves the Alibaba Cloud connection is live before the demo.
//
//   export DASHSCOPE_API_KEY=sk-...   # your Model Studio key
//   node scripts/qwen-smoke-test.mjs
//
// Optional: pass a public JPEG URL to also test Qwen-VL vision reasoning:
//   node scripts/qwen-smoke-test.mjs https://example.com/kitchen.jpg

const BASE =
  process.env.DASHSCOPE_BASE_URL ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const KEY = process.env.DASHSCOPE_API_KEY
const IMAGE = process.argv[2]

if (!KEY) {
  console.error("✗ DASHSCOPE_API_KEY is not set. Get one at https://bailian.console.aliyun.com/")
  process.exit(1)
}

async function call(model, messages) {
  const t0 = Date.now()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: 300 }),
  })
  const ms = Date.now() - t0
  if (!res.ok) {
    console.error(`✗ ${model} → HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`)
    return false
  }
  const data = await res.json()
  console.log(`✓ ${model} (${ms}ms):`)
  console.log("  " + (data.choices?.[0]?.message?.content ?? "").replace(/\n/g, "\n  "))
  console.log(`  tokens: ${JSON.stringify(data.usage ?? {})}\n`)
  return true
}

console.log(`Endpoint: ${BASE}\n`)

const okText = await call(process.env.QWEN_TEXT_MODEL ?? "qwen-plus", [
  { role: "user", content: "Reply with exactly: Sally Air is connected to Alibaba Cloud." },
])

let okVision = true
if (IMAGE) {
  okVision = await call(process.env.QWEN_VISION_MODEL ?? "qwen-vl-max", [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe any air-quality or safety hazards you see in one sentence." },
        { type: "image_url", image_url: { url: IMAGE } },
      ],
    },
  ])
} else {
  console.log("ℹ Skipping vision test (pass a public JPEG URL as an argument to run it).\n")
}

process.exit(okText && okVision ? 0 : 1)
