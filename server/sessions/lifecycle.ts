import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import type { AppContext } from "../context"
import { accessFor } from "../access-data"
import type { MentorService } from "../mentor/service"
import type { SessionStats } from "../mentor/types"

export interface StudySession {
  id: string
  started_at: string
  ended_at: string | null
  status: string
  summary_md: string | null
  stats_json: string | null
  mentor_session_id: string | null
  error: string | null
}

const MEANINGFUL_KINDS = new Set(["run", "quiz_answer", "submit", "mentor_ask", "reading"])

export function getActiveSession(db: AppContext["db"]): StudySession | null {
  return (
    (db
      .prepare("select * from study_sessions where status in ('active', 'finalizing') order by started_at desc limit 1")
      .get() as StudySession | undefined) ?? null
  )
}

export function startSession(context: AppContext): StudySession {
  const active = getActiveSession(context.db)
  if (active) return active
  const session: StudySession = {
    id: `sess_${randomUUID()}`,
    started_at: new Date().toISOString(),
    ended_at: null,
    status: "active",
    summary_md: null,
    stats_json: null,
    mentor_session_id: null,
    error: null,
  }
  context.db
    .prepare(
      `insert into study_sessions (id, started_at, status, mentor_session_id)
       values (?, ?, 'active', null)`,
    )
    .run(session.id, session.started_at)
  return session
}

export function recordActivity(
  context: AppContext,
  event: {
    sessionId?: string
    kind: string
    lessonId?: string
    taskId?: string
    meta?: unknown
  },
): void {
  const sessionId = event.sessionId ?? getActiveSession(context.db)?.id
  if (!sessionId) return
  context.db
    .prepare(
      `insert into activity_events (session_id, kind, lesson_id, task_id, meta_json, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sessionId,
      event.kind,
      event.lessonId ?? null,
      event.taskId ?? null,
      event.meta ? JSON.stringify(event.meta) : null,
      new Date().toISOString(),
    )
}

function hasMeaningfulActivity(context: AppContext, sessionId: string): boolean {
  const rows = context.db
    .prepare("select kind from activity_events where session_id = ?")
    .all(sessionId) as Array<{ kind: string }>
  return rows.some((row) => MEANINGFUL_KINDS.has(row.kind))
}

export function buildSessionStats(context: AppContext, session: StudySession): SessionStats {
  const course = context.getCourse()
  const access = accessFor(context.db, course)
  const lessonRows = context.db
    .prepare("select lesson_id, status, best_grade from lesson_progress")
    .all() as Array<{ lesson_id: string; status: string; best_grade: number | null }>
  const lessonMap = new Map(lessonRows.map((row) => [row.lesson_id, row]))
  const chapterRows = context.db
    .prepare("select chapter_id, status from chapter_progress")
    .all() as Array<{ chapter_id: string; status: string }>
  const chapterMap = new Map(chapterRows.map((row) => [row.chapter_id, row.status]))

  const chapters = course.chapters.map((chapter) => ({
    title: chapter.title,
    passed: chapter.lessonIds.filter((id) => access.lessons[id] === "passed").length,
    total: chapter.lessonIds.length,
  }))

  const currentChapter =
    course.chapters.find((chapter) => {
      const allPassed = chapter.lessonIds.every((id) => access.lessons[id] === "passed")
      return !allPassed || chapterMap.get(chapter.id) !== "passed"
    }) ?? course.chapters[course.chapters.length - 1]

  const required = currentChapter ? currentChapter.lessonIds.length + 1 : 0
  const completed = currentChapter
    ? currentChapter.lessonIds.filter((id) => access.lessons[id] === "passed").length +
      (chapterMap.get(currentChapter.id) === "passed" ? 1 : 0)
    : 0
  const percent = required ? Math.round((completed / required) * 100) : 0

  return {
    startedAt: session.started_at,
    endedAt: session.ended_at ?? new Date().toISOString(),
    chapters,
    lessons: course.chapters
      .flatMap((chapter) => chapter.lessonIds)
      .map((id) => {
        const row = lessonMap.get(id)
        return {
          title: course.lessons[id]?.title ?? id,
          grade: row?.best_grade ?? null,
          status: access.lessons[id] ?? "locked",
        }
      }),
    percent,
  }
}

export async function acquireMentorSession(
  context: AppContext,
  mentor: MentorService,
): Promise<{ sessionId: string; release: () => Promise<void> }> {
  const active = getActiveSession(context.db)
  if (active) {
    let mentorSessionId = active.mentor_session_id
    if (!mentorSessionId) {
      mentorSessionId = await mentor.createSession()
      context.db
        .prepare("update study_sessions set mentor_session_id = ? where id = ?")
        .run(mentorSessionId, active.id)
    }
    return { sessionId: mentorSessionId, release: async () => {} }
  }
  const sessionId = await mentor.createSession()
  return {
    sessionId,
    release: async () => {
      await mentor.deleteSession(sessionId).catch(() => {})
    },
  }
}

function fallbackReport(stats: SessionStats): string {
  return `## Общая оценка
Занятие завершено. Отчёт сформирован без ИИ: итоговая оценка будет видна в «Успеваемости».

## Что прошёл
${stats.lessons.filter((lesson) => lesson.status !== "locked").map((lesson) => `- ${lesson.title}: ${lesson.status}${lesson.grade ? `, ${lesson.grade}/5` : ""}`).join("\n") || "Пока только знакомство с материалами."}

## Процент от задуманного
${stats.percent}% обязательных шагов текущей главы.

## Сильные стороны
- Ты открывал материалы и двигался по программе.

## Слабые стороны
- Недостаточно данных для подробного разбора: учитель был недоступен.

## Напутствие
В следующий раз начни с одного маленького задания и доведи его до запуска.

## Рекомендации по текущей главе
Вернись к теории текущей главы и проверь ключевые примеры в REPL.

## Рекомендации на следующую главу
Перед новым материалом повтори то, что уже проходил.`
}

export async function finalizeSession(
  context: AppContext,
  mentor: MentorService,
  sessionId: string,
): Promise<StudySession> {
  const session = context.db
    .prepare("select * from study_sessions where id = ?")
    .get(sessionId) as StudySession | undefined
  if (!session) throw new Error("session_not_found")
  if (session.status === "completed" || session.status === "completed_with_warnings") return session

  if (!hasMeaningfulActivity(context, sessionId)) {
    context.db
      .prepare("update study_sessions set status = 'discarded', ended_at = ? where id = ?")
      .run(new Date().toISOString(), sessionId)
    return { ...session, status: "discarded" }
  }

  context.db
    .prepare("update study_sessions set status = 'finalizing', ended_at = coalesce(ended_at, ?) where id = ?")
    .run(new Date().toISOString(), sessionId)

  const stats = buildSessionStats(context, { ...session, ended_at: new Date().toISOString() })
  let summary = ""
  let status = "completed"
  let error: string | null = null
  try {
    let mentorSessionId = session.mentor_session_id
    if (!mentorSessionId) {
      mentorSessionId = await mentor.createSession()
    }
    summary = await mentor.summarizeSession(mentorSessionId, stats)
    await mentor.deleteSession(mentorSessionId).catch(() => {})
  } catch (cause) {
    summary = fallbackReport(stats)
    status = "completed_with_warnings"
    error = cause instanceof Error ? cause.message : String(cause)
  }

  const endedAt = new Date().toISOString()
  const fileName = `session-${endedAt.slice(0, 10)}-${sessionId.slice(-8)}.md`
  try {
    mkdirSync(join(process.cwd(), "reports"), { recursive: true })
    writeFileSync(
      join(process.cwd(), "reports", fileName),
      `# Итог занятия\n\n${summary}\n`,
      "utf8",
    )
  } catch {
    // Report file is best-effort; the database is the source of truth.
  }

  context.db
    .prepare(
      `update study_sessions
       set status = ?, ended_at = ?, summary_md = ?, stats_json = ?, mentor_session_id = null, error = ?
       where id = ?`,
    )
    .run(status, endedAt, summary, JSON.stringify(stats), error, sessionId)

  return {
    ...session,
    status,
    ended_at: endedAt,
    summary_md: summary,
    stats_json: JSON.stringify(stats),
    mentor_session_id: null,
    error,
  }
}

export function getLastReport(db: AppContext["db"]): StudySession | null {
  return (
    (db
      .prepare(
        `select * from study_sessions
         where status in ('completed', 'completed_with_warnings') and summary_md is not null
         order by ended_at desc limit 1`,
      )
      .get() as StudySession | undefined) ?? null
  )
}
