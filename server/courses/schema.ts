import { z } from "zod"
import type { Quiz } from "../content/types"

export const VOLUME_LIMITS = {
  short: { min: 2, max: 4 },
  medium: { min: 3, max: 8 },
  long: { min: 6, max: 20 },
} as const

export type Volume = keyof typeof VOLUME_LIMITS

export interface ClarifyAnswer {
  question: string
  answer: string
}

export interface GenerateCourseInput {
  topic: string
  answers: ClarifyAnswer[]
  volume: Volume
}

export const clarifyQuestionSchema = z.object({
  id: z.string().min(1).max(80),
  prompt: z.string().min(5).max(300),
  type: z.enum(["single", "multiple"]),
  options: z.array(z.string().min(1).max(160)).min(2).max(8),
})

export const clarifySchema = z.object({
  questions: z.array(clarifyQuestionSchema).min(1).max(4),
})

export const outlineSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(600),
  theme: z.enum(["forest", "amber", "ocean", "plum", "clay"]),
  icon: z.enum(["book", "code", "chart", "globe", "atom", "scale", "palette", "heart"]),
  mode: z.enum(["general", "math", "programming"]),
  runtime: z.enum(["none", "lua", "c", "cpp", "python", "javascript", "custom"]).optional(),
  mentorPrompt: z.string().min(40).max(8000),
  chapters: z
    .array(
      z.object({
        title: z.string().min(2).max(160),
        description: z.string().max(500).optional().default(""),
        lessons: z.array(z.string().min(2).max(200)).min(1).max(8),
      }),
    )
    .min(1)
    .max(8),
})

export const generatedTaskSchema = z.object({
  title: z.string().min(1).max(200),
  prompt: z.string().min(10).max(8000),
  kind: z.enum(["code", "steps"]).default("code"),
  entry: z.string().max(200).optional(),
  files: z
    .array(z.object({ name: z.string().min(1).max(200), content: z.string().max(200_000) }))
    .default([]),
  args: z.array(z.string()).default([]),
  stdin: z.string().default(""),
  timeoutMs: z.coerce.number().int().min(500).max(10_000).catch(3000),
  criteria: z.array(z.string()).default([]),
})

export const generatedLessonSchema = z.object({
  title: z.string().min(2).max(200),
  theoryMarkdown: z.string().min(100).max(80_000),
  practiceIntro: z.string().max(4000).optional().default(""),
  quiz: z.unknown(),
  tasks: z.array(generatedTaskSchema).default([]),
})

export const FALLBACK_CLARIFY = {
  questions: [
    {
      id: "goal",
      prompt: "Что вам важнее всего в этой теме?",
      type: "multiple" as const,
      options: ["Понять основы", "Разобраться в практике", "Решить конкретную задачу", "Найти свой темп"],
    },
    {
      id: "level",
      prompt: "Какой у вас уровень?",
      type: "single" as const,
      options: ["С нуля", "Что-то знаю", "Уверенно, хочу глубже"],
    },
    {
      id: "focus",
      prompt: "Что включить в курс?",
      type: "multiple" as const,
      options: ["Главные идеи", "Примеры", "Разбор ошибок", "Продвинутые разделы"],
    },
  ],
}

export type ClarifyQuestion = z.infer<typeof clarifyQuestionSchema>
export type Outline = z.infer<typeof outlineSchema>
export interface ParsedLesson extends z.infer<typeof generatedLessonSchema> {
  quiz: Quiz
}
