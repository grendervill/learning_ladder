import { MAX_TEXT_CHARS } from "./parse"
import type { ModelAttachment, StoredAttachment } from "./types"

export function formatMaterials(
  attachments: StoredAttachment[],
  limit = MAX_TEXT_CHARS,
): string {
  const blocks = attachments
    .filter((attachment) => attachment.kind !== "image" && attachment.text?.trim())
    .map((attachment) => `--- Файл: ${attachment.name} ---\n${attachment.text!.trim()}`)
  const joined = blocks.join("\n\n")
  if (joined.length <= limit) return joined
  return `${joined.slice(0, limit).trimEnd()}\n\n[Материалы обрезаны до ${limit} символов.]`
}

export function imageAttachments(attachments: StoredAttachment[]): ModelAttachment[] {
  return attachments
    .filter((attachment) => attachment.kind === "image")
    .map((attachment) => ({
      kind: "image" as const,
      name: attachment.name,
      mime: attachment.mime,
      path: attachment.path,
    }))
}
