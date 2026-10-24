import { fetchJson } from "./api"

export type AttachmentKind = "image" | "pdf" | "document" | "text"

export interface UploadedAttachment {
  id: string
  name: string
  mime: string
  size: number
  kind: AttachmentKind
  createdAt: string
  warning?: string
}

export const MAX_ATTACHMENT_FILES = 5
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
export const ATTACHMENT_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.pdf,.docx,.txt,.md,.csv,.json"

const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".csv",
  ".json",
])

function extension(name: string): string {
  const index = name.lastIndexOf(".")
  return index === -1 ? "" : name.slice(index).toLowerCase()
}

export function validateAttachmentFile(
  file: File,
  existingCount: number,
): string | null {
  if (existingCount >= MAX_ATTACHMENT_FILES) {
    return `Можно приложить не больше ${MAX_ATTACHMENT_FILES} файлов.`
  }
  if (!ALLOWED_EXTENSIONS.has(extension(file.name))) {
    return "Поддерживаются PNG, JPEG, WebP, PDF, DOCX, TXT, MD, CSV и JSON."
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `Файл «${file.name}» больше 25 МБ.`
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

export async function uploadAttachments(
  files: File[],
): Promise<UploadedAttachment[]> {
  const form = new FormData()
  for (const file of files) form.append("files", file)
  const response = await fetch("/api/attachments", { method: "POST", body: form })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? body?.error ?? `request_failed_${response.status}`)
  }
  const data = (await response.json()) as { attachments: UploadedAttachment[] }
  return data.attachments
}

export async function deleteAttachment(id: string): Promise<void> {
  await fetchJson(`/api/attachments/${id}`, { method: "DELETE" })
}

/**
 * Downscales large images in the webview so the upload stays within provider
 * limits without a native image-processing dependency on the server.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return file
  }
  if (file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = 2048
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= 5 * 1024 * 1024) return file
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.86)
    })
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp"
    return new File([blob], name, { type: "image/webp" })
  } catch {
    return file
  }
}
