import type { LessonContent, Quiz, TaskContent } from "./types"

export function publicQuiz(quiz: Quiz | null, reveal = false) {
  if (!quiz) return null
  return {
    title: quiz.title,
    questions: quiz.questions.map((question) => {
      if (question.type === "single") {
        return {
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          options: question.options,
          ...(reveal ? { correct: question.correct, explanation: question.explanation } : {}),
        }
      }
      return {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        placeholder: question.placeholder,
        ...(reveal
          ? { referenceAnswer: question.referenceAnswer, criteria: question.criteria }
          : {}),
      }
    }),
  }
}

export function publicTask(task: TaskContent) {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    kind: task.kind,
    entry: task.entry,
    files: task.files,
    args: task.args,
    stdin: task.stdin,
    timeoutMs: task.timeoutMs,
  }
}

export function publicLesson(lesson: LessonContent) {
  return {
    id: lesson.id,
    title: lesson.title,
    theoryMarkdown: lesson.theoryMarkdown,
    practiceIntro: lesson.practiceIntro,
    tasks: lesson.tasks.map(publicTask),
    quiz: publicQuiz(lesson.quiz),
    errors: lesson.errors,
  }
}
