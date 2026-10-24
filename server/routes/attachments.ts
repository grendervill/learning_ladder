import { Router, type NextFunction, type Request, type Response } from "express"
import multer from "multer"
import type { AppContext } from "../context"
import {
  createAttachment,
  deleteAttachments,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE,
} from "../attachments/store"
import { AttachmentError, type StoredAttachment } from "../attachments/types"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  defParamCharset: "utf8",
})

function publicAttachment(attachment: StoredAttachment) {
  const { id, name, mime, size, kind, createdAt, warning } = attachment
  return { id, name, mime, size, kind, createdAt, ...(warning ? { warning } : {}) }
}

export function createAttachmentsRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.post("/attachments", (req, res, next) => {
    upload.array("files", MAX_FILES)(req, res, async (uploadError) => {
      if (uploadError) {
        next(uploadError)
        return
      }
      const root = getContext().root ?? process.cwd()
      const files = (req.files as Express.Multer.File[] | undefined) ?? []
      if (files.length === 0) {
        res.status(400).json({ error: "files_required", message: "Приложите хотя бы один файл." })
        return
      }
      const total = files.reduce((sum, file) => sum + file.size, 0)
      if (total > MAX_TOTAL_SIZE) {
        res.status(400).json({
          error: "files_too_large",
          message: `Суммарный размер файлов больше ${Math.round(MAX_TOTAL_SIZE / 1024 / 1024)} МБ.`,
        })
        return
      }
      const created: StoredAttachment[] = []
      try {
        for (const file of files) {
          created.push(
            await createAttachment(root, {
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              buffer: file.buffer,
            }),
          )
        }
        res.status(201).json({ attachments: created.map(publicAttachment) })
      } catch (error) {
        deleteAttachments(root, created.map((attachment) => attachment.id))
        next(error)
      }
    })
  })

  router.delete("/attachments/:id", (req, res) => {
    const root = getContext().root ?? process.cwd()
    deleteAttachments(root, [req.params.id])
    res.json({ deleted: true })
  })

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `Файл больше ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} МБ.`
          : error.code === "LIMIT_FILE_COUNT"
            ? `Можно приложить не больше ${MAX_FILES} файлов.`
            : "Не удалось загрузить файлы."
      res.status(400).json({ error: error.code.toLowerCase(), message })
      return
    }
    if (error instanceof AttachmentError) {
      res.status(400).json({ error: error.code, message: error.message })
      return
    }
    next(error)
  })

  return router
}
