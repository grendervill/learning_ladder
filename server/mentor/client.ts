import { randomUUID } from "node:crypto"
import { pathToFileURL } from "node:url"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"
import type { ModelAttachment } from "../attachments/types"
import { DEFAULT_MENTOR_PROMPT } from "../content/defaults"
import {
  KEEP_KEY,
  providerById,
  readSettings,
  resolveApiKey,
  type ReasoningLevel,
} from "../settings"
import { describeProviderError, generateDirect } from "./providers"

const FALLBACK_MODEL = "opencode-go/deepseek-v4.1-flash"
const DEFAULT_MENTOR_AGENT = "course-mentor"
const CONSTRUCTOR_AGENT = "course-constructor"

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

export interface OpencodeModelInfo {
  providerID: string
  modelID: string
  name: string
  variants: string[]
  input?: string[]
  enabled: boolean
  status: string
}

/** Model catalog from the local OpenCode service (including the subscription). */
export async function listOpencodeModels(): Promise<OpencodeModelInfo[]> {
  const client = await getClient()
  const result = await client.model.list()
  return (result.data ?? []).map((model) => ({
    providerID: String(model.providerID),
    modelID: String(model.modelID),
    name: String(model.name ?? model.modelID),
    variants: (model.variants ?? []).map((variant) => String(variant.id)),
    input: (model.capabilities?.input ?? []).map((value) => String(value)),
    enabled: model.enabled !== false,
    status: String(model.status ?? "active"),
  }))
}

function parseModelRef(model: string): { providerID: string; id: string } {
  const [providerID, ...rest] = model.split("/")
  if (!providerID || rest.length === 0) return { providerID: "opencode-go", id: model || FALLBACK_MODEL.split("/")[1] }
  return { providerID, id: rest.join("/") }
}

function directReasoning(value: string): ReasoningLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "off"
}

async function createOpencodeSession(
  title: string,
  model: string,
  agent = DEFAULT_MENTOR_AGENT,
  reasoning = "off",
): Promise<string> {
  const client = await getClient()
  const ref = parseModelRef(model)
  const modelRef = reasoning && reasoning !== "off" ? { ...ref, variant: reasoning } : ref
  const session = await client.session.create({
    title,
    agent,
    model: modelRef,
    location: { directory: process.cwd() },
  } as any)
  return session.id
}

export async function createMentorSession(
  title = "Лестница обучения · наставник",
  agent = DEFAULT_MENTOR_AGENT,
): Promise<string> {
  const settings = readSettings()
  if (settings.network.provider !== "opencode") return `direct-${randomUUID()}`
  return createOpencodeSession(
    title,
    settings.network.model || FALLBACK_MODEL,
    agent,
    settings.network.reasoning,
  )
}

export async function deleteMentorSession(sessionId: string): Promise<void> {
  if (sessionId.startsWith("direct-")) return
  const client = await getClient()
  await client.session.remove({ sessionID: sessionId })
}

function opencodePrompt(prompt: string, system?: string): string {
  const rules = system?.trim()
  if (!rules) return prompt
  return `Правила наставника этого курса:\n${rules}\n\nЗапрос приложения:\n${prompt}`
}

async function opencodeReply(
  sessionId: string,
  prompt: string,
  attachments: ModelAttachment[] | undefined,
  signal: AbortSignal,
): Promise<string> {
  const client = await getClient()
  if (!attachments?.length) {
    const result = await client.session.generate(
      { sessionID: sessionId, prompt },
      { signal },
    )
    return result.text
  }
  await client.session.prompt(
    {
      sessionID: sessionId,
      text: prompt,
      files: attachments.map((attachment) => ({
        uri: pathToFileURL(attachment.path).href,
        name: attachment.name,
      })),
    },
    { signal },
  )
  await client.session.wait({ sessionID: sessionId }, { signal })
  const messages = await client.session.context({ sessionID: sessionId }, { signal })
  const assistant = [...messages].reverse().find((message) => message.type === "assistant")
  const text = (assistant?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim()
  if (!text) throw new Error("provider_empty_response")
  return text
}

export async function generateMentorReply(
  sessionId: string,
  prompt: string,
  system?: string,
  attachments?: ModelAttachment[],
): Promise<string> {
  const settings = readSettings()
  const { provider, model, reasoning, baseUrl } = settings.network
  if (provider !== "opencode") {
    return generateDirect({
      provider,
      model,
      reasoning: directReasoning(reasoning),
      apiKey: resolveApiKey(provider, settings) ?? "",
      baseUrl: provider === "custom" ? baseUrl : undefined,
      system: system?.trim() || DEFAULT_MENTOR_PROMPT,
      prompt,
      maxTokens: 4096,
      ...(attachments?.length ? { attachments } : {}),
    })
  }
  try {
    return await opencodeReply(
      sessionId,
      opencodePrompt(prompt, system),
      attachments,
      AbortSignal.timeout(180_000),
    )
  } catch (error) {
    if (attachments?.length && !(error instanceof Error && error.name === "TimeoutError")) {
      throw new AttachmentPromptError()
    }
    throw error
  }
}

export interface GenerateWithAgentInput {
  agent?: string
  system?: string
  prompt: string
  timeoutMs?: number
  attachments?: ModelAttachment[]
}

export class AttachmentPromptError extends Error {
  readonly code = "attachments_unsupported"

  constructor(
    message = "Не удалось передать файл модели. Выберите модель с поддержкой изображений или приложите текстовый файл.",
  ) {
    super(message)
    this.name = "AttachmentPromptError"
  }
}

/** Fresh session per call: the constructor and course mentor never share context. */
export async function generateWithAgent(input: GenerateWithAgentInput): Promise<string> {
  const settings = readSettings()
  const { provider, model, reasoning, baseUrl } = settings.network
  const timeoutMs = input.timeoutMs ?? 180_000
  if (provider !== "opencode") {
    return generateDirect({
      provider,
      model,
      reasoning: directReasoning(reasoning),
      apiKey: resolveApiKey(provider, settings) ?? "",
      baseUrl: provider === "custom" ? baseUrl : undefined,
      system: input.system?.trim() || DEFAULT_MENTOR_PROMPT,
      prompt: input.prompt,
      maxTokens: 4096,
      signal: AbortSignal.timeout(timeoutMs),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    })
  }
  const sessionId = await createOpencodeSession(
    "Лестница обучения · конструктор",
    model || FALLBACK_MODEL,
    input.agent ?? CONSTRUCTOR_AGENT,
    reasoning,
  )
  try {
    try {
      return await opencodeReply(
        sessionId,
        opencodePrompt(input.prompt, input.system),
        input.attachments,
        AbortSignal.timeout(timeoutMs),
      )
    } catch (error) {
      if (input.attachments?.length && !(error instanceof Error && error.name === "TimeoutError")) {
        throw new AttachmentPromptError(
          "Не удалось передать изображение модели. Выберите модель с поддержкой изображений.",
        )
      }
      throw error
    }
  } finally {
    await deleteMentorSession(sessionId).catch(() => {})
  }
}

export interface MentorTestInput {
  provider?: string
  model?: string
  reasoning?: string
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
      const sessionId = await createOpencodeSession(
        "Лестница обучения · проверка связи",
        model,
        DEFAULT_MENTOR_AGENT,
        reasoning,
      )
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
      reasoning: directReasoning(reasoning),
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
