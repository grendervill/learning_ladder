import { z } from "zod"
import { parseQuiz } from "../content/quiz"
import type { CourseSnapshot, Quiz } from "../content/types"
import {
  createMentorSession as createRealSession,
  deleteMentorSession as deleteRealSession,
  generateMentorReply,
} from "./client"
import { containsReadyCode, sanitizeMentorText, stripReadyCode } from "./guard"
import type {
  MentorClassification,
  MentorContext,
  MentorReviewRequest,
  MentorReviewResult,
  SessionStats,
} from "./types"

const taskFeedbackSchema = z.object({
  taskId: z.string(),
  status: z.enum(["ok", "needs_work", "missing"]).catch("needs_work"),
  comment: z.string().catch(""),
})

const quizFeedbackSchema = z.object({
  questionId: z.string(),
  correct: z.boolean().catch(false),
  comment: z.string().catch(""),
})

const reviewSchema = z.object({
  grade: z.coerce.number().int().min(2).max(5),
  verdict: z.enum(["pass", "retry"]).catch("retry"),
  summary: z.string().catch(""),
  strengths: z.array(z.string()).catch([]),
  issues: z.array(z.string()).catch([]),
  nextStep: z.string().catch(""),
  tasks: z.array(taskFeedbackSchema).catch([]),
  quiz: z.array(quizFeedbackSchema).catch([]),
})

const classificationSchema = z.object({
  assignments: z
    .array(z.object({ folder: z.string(), chapterId: z.string() }))
    .catch([]),
  newChapters: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().catch(""),
        folderIds: z.array(z.string()).catch([]),
      }),
    )
    .catch([]),
  reason: z.string().catch(""),
})

function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // A fenced JSON wrapper may still contain the real object.
    }
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const source = fenced ? fenced[1] : text
  const fencedStart = source.indexOf("{")
  const fencedEnd = source.lastIndexOf("}")
  if (fencedStart === -1 || fencedEnd === -1 || fencedEnd <= fencedStart) {
    throw new Error("json_not_found")
  }
  return JSON.parse(source.slice(fencedStart, fencedEnd + 1))
}

function tryParseReview(text: string): MentorReviewResult | null {
  try {
    return reviewSchema.parse(extractJson(text))
  } catch {
    return null
  }
}

function formatRun(run: MentorReviewRequest["tasks"][number]["lastRun"]): string {
  if (!run) return "запусков не было"
  return `exit=${run.exitCode}${run.timedOut ? " (timeout)" : ""}${run.syntaxError ? " (syntax error)" : ""}\nstdout:\n${run.stdout || "(пусто)"}\nstderr:\n${run.stderr || "(пусто)"}`
}

function buildReviewPrompt(request: MentorReviewRequest): string {
  const tasks = request.tasks
    .map((task) => {
      const files = task.files
        .map((file) => `--- ${file.name} ---\n${file.content}`)
        .join("\n")
      return `### Задание ${task.taskId} · ${task.title} (${task.kind})
Описание: ${task.prompt}
Код ученика:
${files}
Последний запуск:
${formatRun(task.lastRun)}`
    })
    .join("\n\n")

  const quiz = request.quiz
    .map((question) => {
      const answer =
        question.type === "single" && typeof question.answer === "number"
          ? question.options?.[question.answer]
          : question.answer
      const correct =
        question.type === "single"
          ? question.options?.[question.correct ?? -1]
          : question.referenceAnswer
      return `- ${question.id} [${question.type}] ${question.prompt}
  ответ ученика: ${JSON.stringify(answer ?? null)}
  правильный ориентир: ${JSON.stringify(correct ?? null)}
  критерии: ${JSON.stringify(question.criteria ?? [])}`
    })
    .join("\n")

  const previous = (request.previousAttempts ?? [])
    .map((attempt) => `- ${attempt.submittedAt}: ${attempt.grade}/5 — ${attempt.summary}`)
    .join("\n")

  const subject =
    request.scope === "chapter"
      ? `Проверь общий квиз главы «${request.chapterTitle}» (${request.lessonId}). Это итоговая проверка главы, а не отдельного задания.`
      : `Проверь урок «${request.lessonTitle}» (${request.lessonId}) из главы «${request.chapterTitle}».`

  return `${subject}

Требования к проверке:
- оцени уровень понимания и самостоятельность, а не только «работает/не работает»;
- не давай готовый код и не вставляй полные реализации;
- в tasks верни feedback по каждому заданию;
- в quiz верни feedback по каждому вопросу;
- если ответ на вопрос пустой или бессмысленный — correct=false;
- grade 2–5, verdict "pass" только при grade >= 4;
- верни только JSON без Markdown-обёртки.

Предыдущие попытки:
${previous || "нет"}

Теория (кратко):
${(request.theory ?? "").slice(0, 4000)}

Практика:
${tasks || "заданий нет"}

Вопросы:
${quiz || "вопросов нет"}

Формат:
{"grade":4,"verdict":"pass","summary":"...","strengths":["..."],"issues":["..."],"nextStep":"...","tasks":[{"taskId":"...","status":"ok|needs_work|missing","comment":"..."}],"quiz":[{"questionId":"...","correct":true,"comment":"..."}]}`
}

function buildAskPrompt(context: MentorContext, question: string): string {
  const code = context.code?.map((file) => `--- ${file.name} ---\n${file.content}`).join("\n") ?? ""
  const history = (context.history ?? [])
    .slice(-8)
    .map((message) => `${message.role === "user" ? "Ученик" : "Наставник"}: ${message.content}`)
    .join("\n")
  return `Контекст наставника:
Урок: ${context.lessonTitle ?? "не указан"}
Задание: ${context.taskTitle ?? "не указано"}
Код:
${code || "(нет)"}
Последний запуск:
${formatRun(context.lastRun)}
История диалога:
${history || "(начало диалога)"}
Вопрос ученика: ${question}

Ответь как наставник: коротко, по делу, с наводящим вопросом или следующим шагом. Не давай готовый код.`
}

function buildSummaryPrompt(stats: SessionStats): string {
  return `Составь итог учебного занятия по статистике ниже. Пиши по-русски, тепло, но честно.
Обязательные разделы: «Общая оценка», «Что прошёл», «Процент от задуманного», «Сильные стороны», «Слабые стороны», «Напутствие», «Рекомендации по текущей главе», «Рекомендации на следующую главу».
Не выдумывай оценки и факты, которых нет в статистике. Не давай готовый код.

Статистика:
${JSON.stringify(stats, null, 2)}`
}

function buildClassifyPrompt(snapshot: CourseSnapshot, unassigned: string[]): string {
  const chapters = snapshot.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    lessonIds: chapter.lessonIds,
  }))
  const folders = unassigned.map((id) => {
    const lesson = snapshot.lessons[id]
    return {
      folder: id,
      title: lesson?.title ?? id,
      theory: (lesson?.theoryMarkdown ?? "").slice(0, 1600),
      tasks: lesson?.tasks.map((task) => ({ title: task.title, kind: task.kind })) ?? [],
    }
  })
  return `Новые папки курса нужно распределить по главам.
Существующие главы:
${JSON.stringify(chapters, null, 2)}
Новые папки:
${JSON.stringify(folders, null, 2)}

Правила:
- не меняй порядок существующих уроков;
- папку можно добавить только в конец существующей главы или в новую главу;
- если создаёшь новую главу, придумай безопасный id (латиница, цифры, дефисы), название и описание;
- верни только JSON:
{"assignments":[{"folder":"id","chapterId":"existing-or-new"}],"newChapters":[{"id":"...","title":"...","description":"...","folderIds":["..."]}],"reason":"..."}`
}

function mockReview(request: MentorReviewRequest): MentorReviewResult {
  return {
    grade: 4,
    verdict: "pass",
    summary: "Хорошая самостоятельная работа. Основы поняты, есть небольшие места для полировки.",
    strengths: ["Код запускается", "Видно понимание темы"],
    issues: ["Проверь граничные случаи"],
    nextStep: "Переходи к следующей папке, но держи в голове разбор.",
    tasks: request.tasks.map((task) => ({
      taskId: task.taskId,
      status: "ok" as const,
      comment: "Задание выполнено, основная идея верная.",
    })),
    quiz: request.quiz.map((question) => ({
      questionId: question.id,
      correct: true,
      comment: "Ответ по существу верный.",
    })),
  }
}

function mockSummary(stats: SessionStats): string {
  return `## Общая оценка
Хорошее занятие. Ты продвинулся по текущей главе и сохранил рабочий темп.

## Что прошёл
${stats.lessons.filter((lesson) => lesson.status !== "locked").map((lesson) => `- ${lesson.title}: ${lesson.status}`).join("\n") || "Пока только чтение материалов."}

## Процент от задуманного
${stats.percent}% обязательных шагов текущей главы.

## Сильные стороны
- Ты сам запускаешь код и проверяешь результат.
- Видно понимание базовых конструкций.

## Слабые стороны
- Стоит внимательнее проверять крайние случаи.

## Напутствие
Не спеши сдавать. Сначала сформулируй, что именно должен делать код.

## Рекомендации по текущей главе
Перечитай раздел про local и проверь типы в REPL.

## Рекомендации на следующую главу
Повтори таблицы и функции перед следующим шагом.`
}

function mockClassification(snapshot: CourseSnapshot, unassigned: string[]): MentorClassification {
  const first = snapshot.chapters[0]
  if (first) {
    return {
      assignments: unassigned.map((folder) => ({ folder, chapterId: first.id })),
      newChapters: [],
      reason: "Добавлено в первую главу для тестового режима.",
    }
  }
  return {
    assignments: [],
    newChapters: [
      {
        id: "new-materials",
        title: "Новые материалы",
        description: "Темы, добавленные после первой сборки.",
        folderIds: unassigned,
      },
    ],
    reason: "Создана новая глава для тестового режима.",
  }
}

export interface GenerateQuizInput {
  kind: "lesson" | "chapter"
  title: string
  description: string
  tasks: Array<{ title: string; kind: string }>
}

export type MentorGenerate = (sessionId: string, prompt: string) => Promise<string>
export type MentorCreateSession = () => Promise<string>
export type MentorDeleteSession = (sessionId: string) => Promise<void>

export interface MentorServiceOptions {
  mock?: boolean
  generate?: MentorGenerate
  createSession?: MentorCreateSession
  deleteSession?: MentorDeleteSession
}

export interface MentorService {
  createSession: () => Promise<string>
  deleteSession: (sessionId: string) => Promise<void>
  reviewLesson: (sessionId: string, request: MentorReviewRequest) => Promise<MentorReviewResult>
  askMentor: (sessionId: string, context: MentorContext, question: string) => Promise<string>
  summarizeSession: (sessionId: string, stats: SessionStats) => Promise<string>
  classifyFolders: (
    sessionId: string,
    snapshot: CourseSnapshot,
    unassigned: string[],
  ) => Promise<MentorClassification>
  generateQuiz?: (sessionId: string, input: GenerateQuizInput) => Promise<Quiz>
}

export function createMentorService(options: MentorServiceOptions = {}): MentorService {
  const mock = options.mock ?? process.env.MENTOR_MODE === "mock"
  const generate = options.generate ?? generateMentorReply
  const createSession = options.createSession ?? (() => createRealSession())
  const deleteSession = options.deleteSession ?? deleteRealSession

  return {
    createSession: async () => (mock ? "mock-session" : createSession()),
    deleteSession: async (sessionId) => {
      if (!mock) await deleteSession(sessionId)
    },
    async reviewLesson(sessionId, request) {
      if (mock) return mockReview(request)
      const prompt = buildReviewPrompt(request)
      let raw = await generate(sessionId, prompt)
      let result = tryParseReview(raw)
      const needsRetry = !result || containsReadyCode(raw)
      if (needsRetry) {
        raw = await generate(
          sessionId,
          `${prompt}\n\nПредыдущий ответ не прошёл проверку. Верни ТОЛЬКО валидный JSON по схеме, без Markdown-обёртки и без готового кода.`,
        )
        result = tryParseReview(raw)
      }
      if (!result) throw new Error("mentor_invalid_json")
      return sanitizeMentorText(result)
    },
    async askMentor(sessionId, context, question) {
      if (mock) return "Подумай, что именно делает эта строка. Что вернёт type(42)? Попробуй проверить в REPL."
      const prompt = buildAskPrompt(context, question)
      let answer = await generate(sessionId, prompt)
      if (containsReadyCode(answer)) {
        answer = await generate(
          sessionId,
          `${prompt}\n\nУбери фенсед-блоки с готовым кодом. Оставь только подсказку и вопрос.`,
        )
      }
      return stripReadyCode(answer)
    },
    async summarizeSession(sessionId, stats) {
      if (mock) return mockSummary(stats)
      const answer = await generate(sessionId, buildSummaryPrompt(stats))
      return stripReadyCode(answer)
    },
    async classifyFolders(sessionId, snapshot, unassigned) {
      if (mock) return mockClassification(snapshot, unassigned)
      const raw = await generate(sessionId, buildClassifyPrompt(snapshot, unassigned))
      try {
        return sanitizeMentorText(classificationSchema.parse(extractJson(raw)))
      } catch {
        throw new Error("mentor_invalid_classification")
      }
    },
    async generateQuiz(sessionId, input) {
      if (mock) {
        return {
          title: input.title,
          questions: [
            { id: "q1", type: "single", prompt: "Что проверяет эта тема?", options: ["основы", "детали"], correct: 0, explanation: "Основы важнее." },
            { id: "q2", type: "single", prompt: "Что делать при ошибке?", options: ["проверить", "сдаться"], correct: 0, explanation: "Проверяем." },
            { id: "q3", type: "text", prompt: "Объясни главную мысль темы.", referenceAnswer: "Ключевая мысль темы.", criteria: ["мысль"] },
            { id: "q4", type: "text", prompt: "Приведи пример применения.", referenceAnswer: "Пример из практики.", criteria: ["пример"] },
          ],
        }
      }
      const prompt = `Сгенерируй ${input.kind === "chapter" ? "общий квиз главы" : "квиз урока"} «${input.title}» по материалу ниже.
Материал:
${input.description}
Задания: ${JSON.stringify(input.tasks)}

Требования:
- ровно 2 тестовых вопроса с 3–4 вариантами и 2 письменных вопроса;
- правильные ответы и ориентиры для письменных;
- объяснение для каждого тестового вопроса;
- верни только JSON:
{"title":"...","questions":[{"id":"q1","type":"single","prompt":"...","options":["..."],"correct":0,"explanation":"..."},{"id":"q3","type":"text","prompt":"...","referenceAnswer":"...","criteria":["..."]}]}`
      let raw = await generate(sessionId, prompt)
      let parsed = parseQuiz(extractJson(raw))
      if (!parsed.quiz) {
        raw = await generate(sessionId, `${prompt}\n\nПредыдущий ответ не прошёл валидацию. Верни только валидный JSON 2+2.`)
        parsed = parseQuiz(extractJson(raw))
      }
      if (!parsed.quiz) throw new Error("mentor_invalid_quiz")
      return parsed.quiz
    },
  }
}

let defaultService: MentorService | null = null

export function getMentorService(): MentorService {
  if (!defaultService) defaultService = createMentorService()
  return defaultService
}
