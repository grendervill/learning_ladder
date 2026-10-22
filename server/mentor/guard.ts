const FENCED_CODE = /```[^\n]*\n([\s\S]*?)```/g

export function containsReadyCode(text: string): boolean {
  FENCED_CODE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = FENCED_CODE.exec(text))) {
    const lines = match[1].split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (lines.length > 2) return true
  }
  return false
}

export function stripReadyCode(text: string): string {
  return text.replace(FENCED_CODE, (block, body: string) => {
    const lines = body.split(/\r?\n/).filter((line) => line.trim().length > 0)
    return lines.length > 2 ? "[фрагмент скрыт — попробуй собрать сам]" : block
  })
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
