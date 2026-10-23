import { Router } from "express"
import type { CourseGenerator } from "../courses/generator"
import {
  FALLBACK_CLARIFY,
  VOLUME_LIMITS,
  type ClarifyAnswer,
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

export function createCourseBuilderRouter(generator: CourseGenerator): Router {
  const router = Router()

  router.post("/courses/clarify", async (req, res) => {
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : ""
    if (!topic) {
      res.status(400).json({ error: "topic_required" })
      return
    }
    try {
      const questions = await generator.clarify(topic)
      res.json({ questions })
    } catch {
      res.json({ ...FALLBACK_CLARIFY, fallback: true })
    }
  })

  router.post("/courses/generate", (req, res) => {
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
    const input: GenerateCourseInput = {
      topic,
      answers: parseAnswers(req.body?.answers),
      volume: volume as Volume,
    }
    const jobId = generator.start(input)
    res.status(202).json({ jobId })
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
