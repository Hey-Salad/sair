// ─────────────────────────────────────────────────────────────────────────────
//  Qwen on Alibaba Cloud — Model Studio (DashScope) client
// ─────────────────────────────────────────────────────────────────────────────
//
//  PROOF OF ALIBABA CLOUD DEPLOYMENT
//  ---------------------------------
//  This file is the single source of truth for every call Sally Air makes to
//  Alibaba Cloud. All cloud reasoning in the EdgeAgent pipeline (edge camera +
//  air-quality sensors  ->  cloud reasoning  ->  local action) runs through the
//  Qwen models hosted on Alibaba Cloud Model Studio (DashScope), via its
//  OpenAI-compatible endpoint. No provider SDK is required — we speak the
//  compatible REST API directly with fetch.
//
//  Region endpoint (international):
//    https://dashscope-intl.aliyuncs.com/compatible-mode/v1
//  Region endpoint (Beijing / mainland):
//    https://dashscope.aliyuncs.com/compatible-mode/v1
//
//  Auth: Bearer <DASHSCOPE_API_KEY>  (Alibaba Cloud Model Studio API key)
//  Docs: https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
// ─────────────────────────────────────────────────────────────────────────────

export const ALIBABA_MODEL_STUDIO_BASE =
  process.env.DASHSCOPE_BASE_URL ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

/** Qwen models available on Alibaba Cloud Model Studio used by Sally Air. */
export const QWEN_MODELS = {
  /** Multimodal vision+language — reasons over camera frames. */
  vision: process.env.QWEN_VISION_MODEL ?? "qwen-vl-max",
  /** Fast text reasoning — structured decisions / summaries. */
  text: process.env.QWEN_TEXT_MODEL ?? "qwen-plus",
} as const

export class QwenError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "QwenError"
    this.status = status
  }
}

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >

export interface QwenMessage {
  role: "system" | "user" | "assistant"
  content: ChatContent
}

export interface QwenChatOptions {
  model?: string
  messages: QwenMessage[]
  /** Force strict JSON object output. */
  jsonMode?: boolean
  temperature?: number
  maxTokens?: number
  /** Abort the request if Model Studio is slow — keeps the edge loop responsive. */
  timeoutMs?: number
}

export interface QwenChatResult {
  text: string
  model: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

function getApiKey(): string {
  const key = process.env.DASHSCOPE_API_KEY
  if (!key) {
    throw new QwenError(
      "DASHSCOPE_API_KEY is not set. Create a key in Alibaba Cloud Model Studio " +
        "(https://bailian.console.aliyun.com/) and add it to your environment.",
      500,
    )
  }
  return key
}

/**
 * Call a Qwen model on Alibaba Cloud Model Studio (OpenAI-compatible API).
 * This is the ONLY network path to Alibaba Cloud in the platform.
 */
export async function qwenChat(opts: QwenChatOptions): Promise<QwenChatResult> {
  const model = opts.model ?? QWEN_MODELS.text
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000)

  try {
    const res = await fetch(`${ALIBABA_MODEL_STUDIO_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new QwenError(
        `Alibaba Cloud Model Studio returned ${res.status}: ${body.slice(0, 500)}`,
        res.status,
      )
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: QwenChatResult["usage"]
    }
    const text = data.choices?.[0]?.message?.content ?? ""
    return { text, model, usage: data.usage }
  } catch (err) {
    if (err instanceof QwenError) throw err
    if (err instanceof Error && err.name === "AbortError") {
      throw new QwenError("Qwen request timed out (edge fallback should engage)", 504)
    }
    throw new QwenError(
      err instanceof Error ? err.message : "Unknown Qwen error",
      502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Reason over a single camera frame with Qwen-VL on Alibaba Cloud.
 * `imageDataUrl` is a data: URL or public https URL of the JPEG frame.
 */
export async function qwenVisionReason(
  imageDataUrl: string,
  instruction: string,
  opts?: { jsonMode?: boolean; timeoutMs?: number },
): Promise<QwenChatResult> {
  return qwenChat({
    model: QWEN_MODELS.vision,
    jsonMode: opts?.jsonMode,
    timeoutMs: opts?.timeoutMs,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: instruction },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
  })
}
