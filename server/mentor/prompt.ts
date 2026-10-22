import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const FALLBACK_PROMPT = `Ты — наставник по Lua в локальном учебном кабинете «Лестница Lua». Объясняй, а не решай за ученика: задавай наводящие вопросы, показывай, где именно ошибка, и предлагай следующий маленький шаг. Никогда не давай готовый код. Отвечай по-русски, спокойно и конкретно.`

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

export function mentorPromptPath(): string {
  return (
    process.env.LEARNINGLUA_MENTOR_PROMPT_PATH ??
    join(process.cwd(), ".opencode", "agents", "lua-mentor.md")
  )
}

export function readMentorPromptRaw(): string {
  const path = mentorPromptPath()
  if (!existsSync(path)) return ""
  try {
    return readFileSync(path, "utf8")
  } catch {
    return ""
  }
}

/** The system prompt body without the YAML frontmatter that configures the OpenCode agent. */
export function readMentorPrompt(): string {
  const raw = readMentorPromptRaw()
  if (!raw) return FALLBACK_PROMPT
  const body = raw.replace(FRONTMATTER, "").trim()
  return body || FALLBACK_PROMPT
}

/** Replaces the prompt body while keeping the agent frontmatter (model, permissions, hidden) intact. */
export function writeMentorPrompt(body: string): void {
  const path = mentorPromptPath()
  const raw = readMentorPromptRaw()
  const frontmatter = raw.match(FRONTMATTER)?.[0] ?? ""
  const content = `${frontmatter}${body.trim()}\n`
  writeFileSync(path, content, "utf8")
}
