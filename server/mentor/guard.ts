const FENCED_CODE = /```([^\n]*)\n([\s\S]*?)```/g

function isReadyBlock(language: string, body: string): boolean {
  const lines = body.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length > 2) return true
  if (/\bfunction\b/.test(body) && /\bend\b/.test(body)) return true
  if (/^\s*lua\s*$/i.test(language) && lines.length > 1) return true
  return false
}

export function containsReadyCode(text: string): boolean {
  FENCED_CODE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FENCED_CODE.exec(text))) {
    if (isReadyBlock(match[1], match[2])) return true
  }
  return false
}

export function stripReadyCode(text: string): string {
  return text.replace(FENCED_CODE, (block, language: string, body: string) =>
    isReadyBlock(language, body) ? "[фрагмент скрыт — попробуй собрать сам]" : block,
  )
}

export function sanitizeMentorText<T>(value: T): T {
  if (typeof value === "string") return stripReadyCode(value) as T
  if (Array.isArray(value)) return value.map((item) => sanitizeMentorText(item)) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeMentorText(item)]),
    ) as T
  }
  return value
}
