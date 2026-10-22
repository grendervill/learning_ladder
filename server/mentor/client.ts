import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"

const DEFAULT_MODEL = {
  providerID: "opencode-go",
  id: "deepseek-v4.1-flash",
}

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

export async function createMentorSession(title = "LearningLua · наставник"): Promise<string> {
  const client = await getClient()
  const session = await client.session.create({
    title,
    agent: "lua-mentor",
    model: DEFAULT_MODEL,
    location: { directory: process.cwd() },
  } as any)
  return session.id
}

export async function deleteMentorSession(sessionId: string): Promise<void> {
  const client = await getClient()
  await client.session.remove({ sessionID: sessionId })
}

export async function generateMentorReply(sessionId: string, prompt: string): Promise<string> {
  const client = await getClient()
  const result = await client.session.generate(
    { sessionID: sessionId, prompt },
    { signal: AbortSignal.timeout(180_000) },
  )
  return result.text
}
