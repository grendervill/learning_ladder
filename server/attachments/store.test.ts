import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  cleanupExpiredAttachments,
  createAttachment,
  deleteAttachments,
  keepCourseAttachments,
  keepMentorAttachments,
  MAX_FILE_SIZE,
  readAttachments,
} from "./store"
import type { UploadFile } from "./types"
import { formatMaterials, imageAttachments } from "./prompt"

let root: string
const fixtures = join(process.cwd(), "server", "attachments", "__fixtures__")

function upload(name: string, mime: string, data: Buffer | string): UploadFile {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
  return { originalname: name, mimetype: mime, size: buffer.length, buffer }
}

function fixture(name: string, mime: string): UploadFile {
  const buffer = readFileSync(join(fixtures, name))
  return { originalname: name, mimetype: mime, size: buffer.length, buffer }
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=",
  "base64",
)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ladder-attachments-"))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("attachment store", () => {
  it("stores text with a safe name and reads it back", async () => {
    const attachment = await createAttachment(root, upload("../notes.md", "text/markdown", "Hello notes"))

    expect(attachment.kind).toBe("text")
    expect(attachment.name).toBe("notes.md")
    expect(attachment.text).toContain("Hello notes")
    expect(existsSync(attachment.path)).toBe(true)
    expect(attachment.path).toContain(join("data", "attachments", "tmp"))
    expect(readAttachments(root, [attachment.id])[0].text).toContain("Hello notes")
  })

  it("extracts text from PDF and DOCX", async () => {
    const pdf = await createAttachment(root, fixture("sample.pdf", "application/pdf"))
    const docx = await createAttachment(
      root,
      fixture(
        "sample.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    )

    expect(pdf.kind).toBe("pdf")
    expect(pdf.text).toContain("Hello PDF")
    expect(docx.kind).toBe("document")
    expect(docx.text).toContain("Hello DOCX")
  })

  it("stores images without text", async () => {
    const image = await createAttachment(root, upload("pixel.png", "image/png", PNG))

    expect(image.kind).toBe("image")
    expect(image.text).toBeUndefined()
    expect(imageAttachments([image])).toEqual([
      { kind: "image", name: "pixel.png", mime: "image/png", path: image.path },
    ])
  })

  it("rejects unsupported, oversized and legacy doc files", async () => {
    await expect(createAttachment(root, upload("virus.exe", "application/octet-stream", "x"))).rejects.toMatchObject({
      code: "unsupported_type",
    })
    await expect(
      createAttachment(root, {
        originalname: "old.doc",
        mimetype: "application/msword",
        size: 10,
        buffer: Buffer.from("x"),
      }),
    ).rejects.toMatchObject({ code: "unsupported_type" })
    await expect(
      createAttachment(root, {
        originalname: "big.txt",
        mimetype: "text/plain",
        size: MAX_FILE_SIZE + 1,
        buffer: Buffer.from("x"),
      }),
    ).rejects.toMatchObject({ code: "file_too_large" })
  })

  it("copies kept course materials and removes the temporary copy", async () => {
    const attachment = await createAttachment(root, upload("notes.md", "text/markdown", "Hello"))

    const names = keepCourseAttachments(root, "course-1", [attachment.id])

    expect(names).toEqual(["notes.md"])
    expect(existsSync(join(root, "courses", "course-1", "materials", "notes.md"))).toBe(true)
    expect(existsSync(attachment.dir)).toBe(false)
  })

  it("keeps mentor files under the conversation folder", async () => {
    const attachment = await createAttachment(root, upload("notes.md", "text/markdown", "Hello"))

    const names = keepMentorAttachments(root, "conversation-1", [attachment.id])

    expect(names).toEqual(["notes.md"])
    expect(
      existsSync(join(root, "data", "attachments", "mentor", "conversation-1", "notes.md")),
    ).toBe(true)
    expect(existsSync(attachment.dir)).toBe(false)
  })

  it("deletes temporary attachments", async () => {
    const attachment = await createAttachment(root, upload("notes.md", "text/markdown", "Hello"))

    deleteAttachments(root, [attachment.id])

    expect(existsSync(attachment.dir)).toBe(false)
    expect(readAttachments(root, [attachment.id])).toEqual([])
  })

  it("cleans up expired temporary attachments", async () => {
    const attachment = await createAttachment(root, upload("notes.md", "text/markdown", "Hello"))
    utimesSync(attachment.dir, new Date(0), new Date(0))

    expect(cleanupExpiredAttachments(root, 1_000)).toBe(1)
    expect(existsSync(attachment.dir)).toBe(false)
  })

  it("formats and truncates materials", async () => {
    const first = await createAttachment(root, upload("a.md", "text/markdown", "A".repeat(20)))
    const second = await createAttachment(root, upload("b.md", "text/markdown", "B".repeat(20)))

    const formatted = formatMaterials([first, second], 30)

    expect(formatted).toContain("a.md")
    expect(formatted).toContain("[Материалы обрезаны")
    expect(formatted.length).toBeLessThan(120)
  })
})
