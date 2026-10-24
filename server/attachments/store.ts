import { randomUUID } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { basename, extname, join } from "node:path"
import {
  classifyUpload,
  extractAttachmentText,
  hasImageSignature,
  MAX_FILE_SIZE,
  safeFileName,
} from "./parse"
import { AttachmentError, type AttachmentMeta, type StoredAttachment, type UploadFile } from "./types"

export { MAX_FILE_SIZE, MAX_FILES, MAX_TOTAL_SIZE } from "./parse"

const SAFE_SEGMENT = /^[a-zA-Z0-9-]{1,80}$/

function attachmentsRoot(root: string): string {
  return join(root, "data", "attachments")
}

function tmpRoot(root: string): string {
  return join(attachmentsRoot(root), "tmp")
}

function mentorRoot(root: string): string {
  return join(attachmentsRoot(root), "mentor")
}

function safeSegment(value: string): string {
  if (!SAFE_SEGMENT.test(value)) {
    throw new AttachmentError("invalid_id", "Некорректный идентификатор вложения.")
  }
  return value
}

function metaPath(dir: string): string {
  return join(dir, "meta.json")
}

function writeMeta(dir: string, meta: AttachmentMeta): void {
  writeFileSync(metaPath(dir), `${JSON.stringify(meta, null, 2)}\n`, "utf8")
}

function readMeta(dir: string): AttachmentMeta | null {
  try {
    return JSON.parse(readFileSync(metaPath(dir), "utf8")) as AttachmentMeta
  } catch {
    return null
  }
}

function uniqueTarget(dir: string, name: string): string {
  const ext = extname(name)
  const stem = basename(name, ext)
  let candidate = join(dir, name)
  let index = 2
  while (existsSync(candidate)) {
    candidate = join(dir, `${stem}-${index}${ext}`)
    index += 1
  }
  return candidate
}

export async function createAttachment(root: string, file: UploadFile): Promise<StoredAttachment> {
  if (file.size > MAX_FILE_SIZE) {
    throw new AttachmentError(
      "file_too_large",
      `Файл больше ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} МБ.`,
    )
  }
  const { kind, mime } = classifyUpload(file.originalname, file.mimetype)
  if (kind === "image" && !hasImageSignature(file.buffer, mime)) {
    throw new AttachmentError(
      "unreadable_file",
      "Файл не похож на изображение PNG, JPEG или WebP.",
    )
  }
  const id = randomUUID()
  const name = safeFileName(file.originalname)
  const dir = join(tmpRoot(root), id)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  try {
    writeFileSync(path, file.buffer)
    const text = await extractAttachmentText(kind, file.buffer)
    const meta: AttachmentMeta = {
      id,
      name,
      storedName: name,
      mime,
      size: file.size,
      kind,
      createdAt: new Date().toISOString(),
      ...(text ? { textFile: "text.txt" } : {}),
    }
    if (text) writeFileSync(join(dir, "text.txt"), text, "utf8")
    writeMeta(dir, meta)
    return { ...meta, dir, path, ...(text ? { text } : {}) }
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw error
  }
}

export function readAttachments(root: string, ids: string[]): StoredAttachment[] {
  const result: StoredAttachment[] = []
  for (const id of ids) {
    if (!SAFE_SEGMENT.test(id)) continue
    const dir = join(tmpRoot(root), id)
    const meta = readMeta(dir)
    if (!meta) continue
    let text: string | undefined
    if (meta.textFile) {
      try {
        text = readFileSync(join(dir, meta.textFile), "utf8")
      } catch {
        text = undefined
      }
    }
    result.push({ ...meta, dir, path: join(dir, meta.storedName), ...(text ? { text } : {}) })
  }
  return result
}

export function deleteAttachments(root: string, ids: string[]): void {
  for (const id of ids) {
    if (!SAFE_SEGMENT.test(id)) continue
    rmSync(join(tmpRoot(root), id), { recursive: true, force: true })
  }
}

export function keepCourseAttachments(root: string, courseId: string, ids: string[]): string[] {
  safeSegment(courseId)
  const targetDir = join(root, "courses", courseId, "materials")
  mkdirSync(targetDir, { recursive: true })
  const names: string[] = []
  for (const attachment of readAttachments(root, ids)) {
    const target = uniqueTarget(targetDir, attachment.name)
    copyFileSync(attachment.path, target)
    names.push(basename(target))
    rmSync(attachment.dir, { recursive: true, force: true })
  }
  return names
}

export function keepMentorAttachments(
  root: string,
  conversationId: string,
  ids: string[],
): string[] {
  safeSegment(conversationId)
  const targetDir = join(mentorRoot(root), conversationId)
  mkdirSync(targetDir, { recursive: true })
  const names: string[] = []
  for (const attachment of readAttachments(root, ids)) {
    const target = uniqueTarget(targetDir, attachment.name)
    copyFileSync(attachment.path, target)
    names.push(basename(target))
    rmSync(attachment.dir, { recursive: true, force: true })
  }
  return names
}

export function cleanupExpiredAttachments(root: string, maxAgeMs = 24 * 60 * 60 * 1000): number {
  const dir = tmpRoot(root)
  if (!existsSync(dir)) return 0
  let removed = 0
  const now = Date.now()
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(dir, entry.name)
    try {
      if (now - statSync(path).mtimeMs > maxAgeMs) {
        rmSync(path, { recursive: true, force: true })
        removed += 1
      }
    } catch {
      // A concurrently removed attachment is fine.
    }
  }
  return removed
}
