import { extname } from "node:path"
import mammoth from "mammoth"
import { extractText as extractPdfText } from "unpdf"
import { AttachmentError, type AttachmentKind } from "./types"

export const MAX_FILES = 5
export const MAX_FILE_SIZE = 25 * 1024 * 1024
export const MAX_TOTAL_SIZE = 50 * 1024 * 1024
export const MAX_TEXT_CHARS = 120_000

const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
}

const TEXT_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
}

export interface ClassifiedUpload {
  kind: AttachmentKind
  mime: string
}

export function classifyUpload(name: string, mime: string): ClassifiedUpload {
  const ext = extname(name).toLowerCase()
  const normalized = (mime || "").toLowerCase()

  if (ext === ".doc") {
    throw new AttachmentError(
      "unsupported_type",
      "Старый формат .doc не поддерживается. Сохраните документ как .docx.",
    )
  }
  if (IMAGE_TYPES[ext]) {
    if (
      normalized === IMAGE_TYPES[ext] ||
      normalized === "application/octet-stream" ||
      normalized === ""
    ) {
      return { kind: "image", mime: IMAGE_TYPES[ext] }
    }
  }
  if (ext === ".pdf") {
    if (normalized === "application/pdf" || normalized === "application/octet-stream" || normalized === "") {
      return { kind: "pdf", mime: "application/pdf" }
    }
  }
  if (ext === ".docx") {
    if (
      normalized === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      normalized === "application/octet-stream" ||
      normalized === ""
    ) {
      return {
        kind: "document",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    }
  }
  if (TEXT_TYPES[ext]) {
    if (
      normalized === TEXT_TYPES[ext] ||
      normalized === "text/plain" ||
      normalized === "application/octet-stream" ||
      normalized === ""
    ) {
      return { kind: "text", mime: TEXT_TYPES[ext] }
    }
  }
  throw new AttachmentError(
    "unsupported_type",
    "Поддерживаются PNG, JPEG, WebP, PDF, DOCX, TXT, MD, CSV и JSON.",
  )
}

export function safeFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file"
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\.{2,}/g, ".")
    .trim()
    .replace(/\s+/g, " ")
  const limited = cleaned.slice(0, 120).replace(/^\.+/, "")
  return limited || "file"
}

export async function extractAttachmentText(
  kind: AttachmentKind,
  buffer: Buffer,
): Promise<string | undefined> {
  if (kind === "image") return undefined
  if (kind === "text") {
    return buffer.toString("utf8").replace(/^\uFEFF/, "").trim()
  }
  if (kind === "pdf") {
    try {
      const { text } = await extractPdfText(new Uint8Array(buffer), { mergePages: true })
      const normalized = text.trim()
      if (!normalized) {
        throw new AttachmentError(
          "pdf_without_text",
          "В PDF не найден текстовый слой. Приложите PDF с текстом или изображения страниц.",
        )
      }
      return normalized
    } catch (cause) {
      if (cause instanceof AttachmentError) throw cause
      throw new AttachmentError(
        "unreadable_file",
        "Не удалось прочитать PDF. Файл повреждён или это не PDF.",
      )
    }
  }
  try {
    const result = await mammoth.extractRawText({ buffer })
    const normalized = result.value.trim()
    if (!normalized) {
      throw new AttachmentError(
        "document_without_text",
        "В документе не найден текст. Проверьте файл или сохраните его как PDF.",
      )
    }
    return normalized
  } catch (cause) {
    if (cause instanceof AttachmentError) throw cause
    throw new AttachmentError(
      "unreadable_file",
      "Не удалось прочитать документ. Файл повреждён или это не DOCX.",
    )
  }
}

export function hasImageSignature(buffer: Buffer, mime: string): boolean {
  if (mime === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    )
  }
  if (mime === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mime === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    )
  }
  return false
}
