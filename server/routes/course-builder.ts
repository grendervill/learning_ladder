import { Router } from "express"
import type { AppContext } from "../context"
import { imageAttachments, formatMaterials } from "../attachments/prompt"
import { readAttachments } from "../attachments/store"
import { supportsImages } from "../attachments/model-support"
import { AttachmentError } from "../attachments/types"
import type { CourseGenerator } from "../courses/generator"
import {
  FALLBACK_CLARIFY,
  VOLUME_LIMITS,
  type ClarifyAnswer,
  type CourseMaterials,
  type GenerateCourseInput,
  type Volume,
} from "../courses/schema"

function parseAnswers(value: unknown): ClarifyAnswer[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is ClarifyAnswer =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as ClarifyAnswer).question === "string" &&
            typeof (item as ClarifyAnswer).answer === "string",
        ),
    )
    .map((item) => ({
      question: item.question.slice(0, 500),
      answer: item.answer.slice(0, 4000),
    }))
}

function parseAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === "string").slice(0, 5)
}

async function materialsFor(
  context: AppContext,
  body: Record<string, any> | undefined,
): Promise<CourseMaterials | undefined> {
  const ids = parseAttachmentIds(body?.attachmentIds)
  if (ids.length === 0) return undefined
  const root = context.root ?? process.cwd()
  const attachments = readAttachments(root, ids)
  if (attachments.length !== ids.length) {
    throw new AttachmentError("attachment_not_found", "Часть приложенных файлов не найдена.")
  }
  const images = imageAttachments(attachments)
  if (images.length > 0 && !(await supportsImages())) {
    throw new AttachmentError(
      "model_without_vision",
      "Выбранная модель не принимает изображения. Выберите модель с поддержкой vision или приложите PDF/документ.",
    )
  }
  return {
    text: formatMaterials(attachments),
    images,
    attachments,
    keep: Boolean(body?.keepAttachments),
  }
}

function attachmentError(res: import("express").Response, error: unknown): boolean {
  if (!(error instanceof AttachmentError)) return false
  res.status(400).json({ error: error.code, message: error.message })
  return true
}

export function createCourseBuilderRouter(
  generator: CourseGenerator,
  getContext?: () => AppContext,
): Router {
  const router = Router()

  router.post("/courses/clarify", async (req, res, next) => {
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : ""
    if (!topic) {
      res.status(400).json({ error: "topic_required" })
      return
    }
    try {
      const context = getContext?.()
      const materials = context ? await materialsFor(context, req.body) : undefined
      const questions = await generator.clarify(topic, materials)
      res.json({ questions })
    } catch (error) {
      if (attachmentError(res, error)) return
      res.json({ ...FALLBACK_CLARIFY, fallback: true })
    }
  })

  router.post("/courses/generate", async (req, res, next) => {
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : ""
    if (!topic) {
      res.status(400).json({ error: "topic_required" })
      return
    }
    const volume = req.body?.volume
    if (typeof volume !== "string" || !(volume in VOLUME_LIMITS)) {
      res.status(400).json({ error: "invalid_volume" })
      return
    }
    try {
      const context = getContext?.()
      const materials = context ? await materialsFor(context, req.body) : undefined
      const input: GenerateCourseInput = {
        topic,
        answers: parseAnswers(req.body?.answers),
        volume: volume as Volume,
        ...(materials ? { materials } : {}),
      }
      const jobId = generator.start(input)
      res.status(202).json({ jobId })
    } catch (error) {
      if (attachmentError(res, error)) return
      next(error)
    }
  })

  router.get("/courses/jobs/:id", (req, res) => {
    const job = generator.getJob(req.params.id)
    if (!job) {
      res.status(404).json({ error: "job_not_found" })
      return
    }
    res.json(job)
  })

  router.post("/courses/jobs/:id/cancel", (req, res) => {
    if (!generator.getJob(req.params.id)) {
      res.status(404).json({ error: "job_not_found" })
      return
    }
    res.json({ cancelled: generator.cancelJob(req.params.id) })
  })

  return router
}
