import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { AppContext } from "../context"
import type { MentorService } from "../mentor/service"
import type { MentorClassification } from "../mentor/types"
import { acquireMentorSession } from "../sessions/lifecycle"
import { scanProject } from "./courses"
import type { CourseSnapshot, Quiz } from "./types"

let classifying = false

function luaCourseRoot(root: string): string {
  return join(root, "courses", "lua")
}

function readChapters(root: string): { chapters: any[] } {
  const path = join(luaCourseRoot(root), "course", "chapters.json")
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function validateClassification(
  snapshot: CourseSnapshot,
  classification: MentorClassification,
): { ok: true } | { ok: false; reason: string } {
  const unassigned = new Set(snapshot.unassigned)
  const existing = new Set(snapshot.chapters.map((chapter) => chapter.id))
  const newIds = new Set<string>()
  for (const chapter of classification.newChapters) {
    if (!/^[a-z0-9-]+$/.test(chapter.id)) return { ok: false, reason: `Некорректный id главы: ${chapter.id}` }
    if (existing.has(chapter.id) || newIds.has(chapter.id)) {
      return { ok: false, reason: `Глава уже существует: ${chapter.id}` }
    }
    newIds.add(chapter.id)
  }
  const assigned = new Set<string>()
  for (const assignment of classification.assignments) {
    if (!unassigned.has(assignment.folder)) {
      return { ok: false, reason: `Папка не в списке новых: ${assignment.folder}` }
    }
    if (assigned.has(assignment.folder)) {
      return { ok: false, reason: `Папка назначена дважды: ${assignment.folder}` }
    }
    if (!existing.has(assignment.chapterId) && !newIds.has(assignment.chapterId)) {
      return { ok: false, reason: `Неизвестная глава: ${assignment.chapterId}` }
    }
    assigned.add(assignment.folder)
  }
  for (const chapter of classification.newChapters) {
    for (const folder of chapter.folderIds) {
      if (!unassigned.has(folder)) return { ok: false, reason: `В новую главу попала чужая папка: ${folder}` }
    }
  }
  return { ok: true }
}

async function generateMissingQuizzes(
  root: string,
  snapshot: CourseSnapshot,
  classification: MentorClassification,
  mentor: MentorService,
  sessionId: string,
) {
  if (!mentor.generateQuiz) return
  const courseRoot = luaCourseRoot(root)
  for (const chapter of classification.newChapters) {
    const path = join(courseRoot, "course", "chapter-quizzes", `${chapter.id}.json`)
    if (existsSync(path)) continue
    try {
      const quiz = await mentor.generateQuiz(sessionId, {
        kind: "chapter",
        title: chapter.title,
        description: chapter.description,
        tasks: [],
      })
      writeJson(path, quiz)
    } catch {
      // The chapter stays without a quiz; the content error will be visible in the UI.
    }
  }

  const assignedFolders = new Set(classification.assignments.map((item) => item.folder))
  for (const folder of assignedFolders) {
    const path = join(courseRoot, "lessons", folder, "quiz.json")
    if (existsSync(path)) continue
    const lesson = snapshot.lessons[folder]
    if (!lesson) continue
    try {
      const quiz = await mentor.generateQuiz(sessionId, {
        kind: "lesson",
        title: lesson.title,
        description: lesson.theoryMarkdown.slice(0, 3000),
        tasks: lesson.tasks.map((task) => ({ title: task.title, kind: task.kind })),
      })
      writeJson(path, quiz)
    } catch {
      // Same: missing quiz is a visible content error, not a crash.
    }
  }
}

export async function classifyAndApply(
  context: AppContext,
  mentor: MentorService,
  root = process.cwd(),
): Promise<{ applied: boolean; snapshot: CourseSnapshot; reason?: string }> {
  if (classifying) {
    return { applied: false, snapshot: context.getCourse(), reason: "already_running" }
  }
  const snapshot = context.getCourse()
  if (snapshot.unassigned.length === 0) {
    return { applied: false, snapshot, reason: "nothing_to_classify" }
  }

  classifying = true
  const acquired = await acquireMentorSession(context, mentor)
  try {
    const classification = await mentor.classifyFolders(acquired.sessionId, snapshot, snapshot.unassigned)
    const valid = validateClassification(snapshot, classification)
    if (!valid.ok) {
      return { applied: false, snapshot, reason: valid.reason }
    }

    const chaptersFile = readChapters(root)
    for (const assignment of classification.assignments) {
      const chapter = chaptersFile.chapters.find((item) => item.id === assignment.chapterId)
      if (chapter && !chapter.lessonIds.includes(assignment.folder)) {
        chapter.lessonIds.push(assignment.folder)
      }
    }
    for (const chapter of classification.newChapters) {
      if (!chaptersFile.chapters.some((item) => item.id === chapter.id)) {
        chaptersFile.chapters.push({
          id: chapter.id,
          title: chapter.title,
          description: chapter.description,
          lessonIds: chapter.folderIds,
          quizFile: `${chapter.id}.json`,
        })
      }
    }
    writeJson(join(luaCourseRoot(root), "course", "chapters.json"), chaptersFile)

    await generateMissingQuizzes(root, snapshot, classification, mentor, acquired.sessionId)

    const updated = context.refreshCourse?.() ?? scanProject(root)
    return { applied: true, snapshot: updated }
  } finally {
    classifying = false
    await acquired.release()
  }
}

export function isClassificationRunning(): boolean {
  return classifying
}
