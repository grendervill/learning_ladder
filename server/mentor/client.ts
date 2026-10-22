import { randomUUID } from "node:crypto"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"
import {
  KEEP_KEY,
  providerById,
  readSettings,
  resolveApiKey,
  type ReasoningLevel,
} from "../settings"
import { readMentorPrompt } from "./prompt"
import { describeProviderError, generateDirect } from "./providers"

const FALLBACK_MODEL = "opencode-go/deepseek-v4.1-flash"

let clientPromise: ReturnType<typeof OpenCode.make> | null = null

async function getClient() {
  if (!clientPromise) {
    const endpoint = await Service.ensure()
    clientPromise = OpenCode.make({
      baseUrl: endpoint.url,
      headers: Service.headers(endpoint),
    })
  }
  return clientPromise
}

function parseModelRef(model: string): { providerID: string; id: string } {
  const [providerID, ...rest] = model.split("/")
  if (!providerID || rest.length === 0) return { providerID: "opencode-go", id: model || FALLBACK_MODEL.split("/")[1] }
  return { providerID, id: rest.join("/") }
}

async function createOpencodeSession(title: string, model: string): Promise<string> {
  const client = await getClient()
  const session = await client.session.create({
    title,
    agent: "lua-mentor",
    model: parseModelRef(model),
    location: { directory: process.cwd() },
  } as any)
  return session.id
}

export async function createMentorSession(title = "LearningLua · наставник"): Promise<string> {
  const settings = readSettings()
  if (settings.network.provider !== "opencode") return `direct-${randomUUID()}`
  return createOpencodeSession(title, settings.network.model || FALLBACK_MODEL)
}

export async function deleteMentorSession(sessionId: string): Promise<void> {
  if (sessionId.startsWith("direct-")) return
  const client = await getClient()
  await client.session.remove({ sessionID: sessionId })
}

export async function generateMentorReply(sessionId: string, prompt: string): Promise<string> {
  const settings = readSettings()
  const { provider, model, reasoning, baseUrl } = settings.network
  if (provider !== "opencode") {
    return generateDirect({
      provider,
      model,
      reasoning,
      apiKey: resolveApiKey(provider, settings) ?? "",
      baseUrl: provider === "custom" ? baseUrl : undefined,
      system: readMentorPrompt(),
      prompt,
      maxTokens: 4096,
    })
  }
  const client = await getClient()
  const result = await client.session.generate(
    { sessionID: sessionId, prompt },
    { signal: AbortSignal.timeout(180_000) },
  )
  return result.text
}

export interface MentorTestInput {
  provider?: string
  model?: string
  reasoning?: ReasoningLevel
  apiKey?: string
  baseUrl?: string
}

export interface MentorTestResult {
  ok: boolean
  provider: string
  model: string
  ms: number
  reply?: string
  error?: string
}

export async function testMentorConnection(input: MentorTestInput = {}): Promise<MentorTestResult> {
  const settings = readSettings()
  const provider = input.provider ?? settings.network.provider
  const model =
    input.model?.trim() ||
    (provider === settings.network.provider ? settings.network.model : providerById(provider)?.defaultModel) ||
    FALLBACK_MODEL
  const reasoning = input.reasoning ?? settings.network.reasoning
  const typedKey = input.apiKey && input.apiKey !== KEEP_KEY ? input.apiKey : ""
  const apiKey = typedKey || resolveApiKey(provider, settings) || ""
  const baseUrl =
    input.baseUrl?.trim() ||
    (provider === "custom" ? settings.network.baseUrl : "") ||
    undefined

  const started = Date.now()
  try {
    if (provider === "opencode") {
      const sessionId = await createOpencodeSession("LearningLua · проверка связи", model)
      let reply = ""
      try {
        const result = await getClient().then((client) =>
          client.session.generate(
            { sessionID: sessionId, prompt: "Ответь одним словом: работает." },
            { signal: AbortSignal.timeout(90_000) },
          ),
        )
        reply = result.text
      } finally {
        await deleteMentorSession(sessionId).catch(() => {})
      }
      return { ok: true, provider, model, ms: Date.now() - started, reply: reply.slice(0, 200) }
    }
    const reply = await generateDirect({
      provider,
      model,
      reasoning,
      apiKey,
      baseUrl,
      system: "Ты проверяешь соединение. Отвечай предельно коротко.",
      prompt: "Ответь одним словом: работает.",
      maxTokens: 64,
      signal: AbortSignal.timeout(90_000),
    })
    return { ok: true, provider, model, ms: Date.now() - started, reply: reply.slice(0, 200) }
  } catch (error) {
    return {
      ok: false,
      provider,
      model,
      ms: Date.now() - started,
      error: describeProviderError(error),
    }
  }
}
