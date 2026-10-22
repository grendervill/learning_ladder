import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parseQuiz } from "./quiz"
import { parseTasks } from "./tasks"
import { splitTheory } from "./theory"
import type {
  Chapter,
  ChapterFile,
  ContentError,
  CourseSnapshot,
  LessonContent,
} from "./types"

function readJson(path: string, onRead?: (content: string) => void): unknown {
  const content = readFileSync(path, "utf8")
  onRead?.(content)
  return JSON.parse(content)
}

function error(code: string, message: string, extra: Partial<ContentError> = {}): ContentError {
  return { code, message, ...extra }
}

export function scanCourse(root: string): CourseSnapshot {
  const errors: ContentError[] = []
  const hash = createHash("sha1")
  const record = (path: string, content: string) => {
    hash.update(path)
    hash.update("\0")
    hash.update(content)
    hash.update("\0")
  }

  const lessonsDir = join(root, "lessons")
  const chaptersPath = join(root, "course", "chapters.json")
  let chapterFiles: ChapterFile[] = []

  if (!existsSync(chaptersPath)) {
    errors.push(error("course_structure_missing", "Нет course/chapters.json", { path: chaptersPath }))
  } else {
    try {
      const raw = readJson(chaptersPath, (content) => record("course/chapters.json", content)) as {
        chapters?: unknown
      }
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.chapters)) {
        errors.push(error("course_structure_invalid", "chapters.json должен содержать массив chapters", { path: chaptersPath }))
      } else {
        chapterFiles = raw.chapters.filter((chapter): chapter is ChapterFile => {
          return Boolean(
            chapter &&
              typeof chapter === "object" &&
              typeof (chapter as ChapterFile).id === "string" &&
              typeof (chapter as ChapterFile).title === "string" &&
              Array.isArray((chapter as ChapterFile).lessonIds),
          )
        })
        if (chapterFiles.length !== raw.chapters.length) {
          errors.push(error("course_structure_invalid", "Некоторые главы в chapters.json имеют неверный формат", { path: chaptersPath }))
        }
      }
    } catch (cause) {
      errors.push(error("course_structure_invalid", `Не удалось прочитать chapters.json: ${String(cause)}`, { path: chaptersPath }))
    }
  }

  const lessons: Record<string, LessonContent> = {}
  if (existsSync(lessonsDir)) {
    for (const entry of readdirSync(lessonsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue
      const lessonId = entry.name
      const lessonDir = join(lessonsDir, lessonId)
      const lessonErrors: ContentError[] = []
      const readmePath = join(lessonDir, "README.md")
      let markdown = ""
      if (!existsSync(readmePath)) {
        lessonErrors.push(error("lesson_missing_readme", "В папке урока нет README.md", { lessonId, path: readmePath }))
      } else {
        try {
          markdown = readFileSync(readmePath, "utf8")
          record(`lessons/${lessonId}/README.md`, markdown)
        } catch (cause) {
          lessonErrors.push(
            error("lesson_read_error", `Не удалось прочитать README.md: ${String(cause)}`, {
              lessonId,
              path: readmePath,
            }),
          )
        }
      }

      const split = splitTheory(markdown, lessonId)
      const quizPath = join(lessonDir, "quiz.json")
      let quiz = null
      if (!existsSync(quizPath)) {
        lessonErrors.push(error("lesson_quiz_missing", "В папке урока нет quiz.json", { lessonId, path: quizPath }))
      } else {
        try {
          const parsed = parseQuiz(readJson(quizPath, (content) => record(`lessons/${lessonId}/quiz.json`, content)))
          quiz = parsed.quiz
          for (const issue of parsed.errors) lessonErrors.push({ ...issue, lessonId, path: quizPath })
        } catch (cause) {
          lessonErrors.push(error("lesson_quiz_invalid", `Не удалось прочитать quiz.json: ${String(cause)}`, { lessonId, path: quizPath }))
        }
      }

      const tasks = parseTasks(lessonDir, lessonId, lessonErrors)
      if (tasks.length === 0) {
        lessonErrors.push(error("lesson_missing_tasks", "В папке урока нет практических заданий", { lessonId, path: join(lessonDir, "tasks") }))
      }

      lessons[lessonId] = {
        id: lessonId,
        title: split.title,
        theoryMarkdown: split.theoryMarkdown,
        practiceIntro: split.practiceIntro,
        tasks,
        quiz,
        errors: lessonErrors,
      }
      errors.push(...lessonErrors)
    }
  } else {
    errors.push(error("lessons_missing", "Нет папки lessons", { path: lessonsDir }))
  }

  const assigned = new Map<string, string>()
  const chapters: Chapter[] = []
  for (const chapterFile of chapterFiles) {
    const chapterErrors: ContentError[] = []
    for (const lessonId of chapterFile.lessonIds) {
      const previous = assigned.get(lessonId)
      if (previous && previous !== chapterFile.id) {
        chapterErrors.push(
          error("lesson_assigned_twice", `Урок ${lessonId} уже в главе ${previous}`, {
            chapterId: chapterFile.id,
            lessonId,
          }),
        )
      } else if (!lessons[lessonId]) {
        chapterErrors.push(
          error("chapter_lesson_missing", `В главе ${chapterFile.id} указан несуществующий урок ${lessonId}`, {
            chapterId: chapterFile.id,
            lessonId,
          }),
        )
      }
      assigned.set(lessonId, chapterFile.id)
    }

    const quizFile = chapterFile.quizFile || `${chapterFile.id}.json`
    const chapterQuizPath = join(root, "course", "chapter-quizzes", quizFile)
    let quiz = null
    if (!existsSync(chapterQuizPath)) {
      chapterErrors.push(
        error("chapter_quiz_missing", "Нет общего квиза главы", {
          chapterId: chapterFile.id,
          path: chapterQuizPath,
        }),
      )
    } else {
      try {
        const parsed = parseQuiz(
          readJson(chapterQuizPath, (content) => record(`course/chapter-quizzes/${quizFile}`, content)),
        )
        quiz = parsed.quiz
        for (const issue of parsed.errors) {
          chapterErrors.push({ ...issue, chapterId: chapterFile.id, path: chapterQuizPath })
        }
      } catch (cause) {
        chapterErrors.push(
          error("chapter_quiz_invalid", `Не удалось прочитать квиз главы: ${String(cause)}`, {
            chapterId: chapterFile.id,
            path: chapterQuizPath,
          }),
        )
      }
    }

    chapters.push({
      id: chapterFile.id,
      title: chapterFile.title,
      description: chapterFile.description ?? "",
      lessonIds: chapterFile.lessonIds,
      quiz,
      errors: chapterErrors,
    })
    errors.push(...chapterErrors)
  }

  const unassigned = Object.keys(lessons).filter((lessonId) => !assigned.has(lessonId)).sort()

  return {
    version: hash.digest("hex"),
    chapters,
    lessons,
    unassigned,
    errors,
  }
}
