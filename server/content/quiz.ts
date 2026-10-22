import type { ContentError, Question, Quiz } from "./types"

export type { Quiz } from "./types"

function error(code: string, message: string): ContentError {
  return { code, message }
}

export function validateQuiz(quiz: Quiz): ContentError[] {
  const errors: ContentError[] = []
  if (!quiz || typeof quiz.title !== "string" || !Array.isArray(quiz.questions)) {
    return [error("quiz_invalid", "Квиз должен содержать title и questions")]
  }
  if (quiz.questions.length < 4) {
    errors.push(error("quiz_too_short", "В квизе должно быть минимум 4 вопроса"))
  }

  const single = quiz.questions.filter((question) => question.type === "single").length
  const text = quiz.questions.filter((question) => question.type === "text").length
  if (single === 0 || text === 0 || single !== text) {
    errors.push(error("quiz_ratio", `Квиз должен быть 50/50: тестов ${single}, письменных ${text}`))
  }

  const seen = new Set<string>()
  for (const question of quiz.questions) {
    if (!question.id || typeof question.id !== "string") {
      errors.push(error("question_invalid_id", "У каждого вопроса должен быть строковый id"))
      continue
    }
    if (seen.has(question.id)) {
      errors.push(error("quiz_duplicate_id", `Повторяется id вопроса: ${question.id}`))
    }
    seen.add(question.id)

    if (question.type === "single") {
      if (!Array.isArray(question.options) || question.options.length < 2) {
        errors.push(error("question_invalid_options", `Вопрос ${question.id}: нужно минимум 2 варианта`))
      } else if (
        !Number.isInteger(question.correct) ||
        question.correct < 0 ||
        question.correct >= question.options.length
      ) {
        errors.push(error("question_correct_out_of_range", `Вопрос ${question.id}: correct вне диапазона`))
      }
      if (typeof question.explanation !== "string") {
        errors.push(error("question_missing_explanation", `Вопрос ${question.id}: нет explanation`))
      }
    } else {
      if (typeof question.referenceAnswer !== "string" || !question.referenceAnswer.trim()) {
        errors.push(error("question_missing_reference", `Вопрос ${question.id}: нет referenceAnswer`))
      }
      if (!Array.isArray(question.criteria) || question.criteria.length === 0) {
        errors.push(error("question_missing_criteria", `Вопрос ${question.id}: нет criteria`))
      }
    }
  }

  return errors
}

export function parseQuiz(value: unknown): { quiz: Quiz | null; errors: ContentError[] } {
  if (!value || typeof value !== "object") {
    return { quiz: null, errors: [error("quiz_invalid", "quiz.json должен быть объектом")] }
  }
  const candidate = value as Partial<Quiz>
  if (typeof candidate.title !== "string" || !Array.isArray(candidate.questions)) {
    return { quiz: null, errors: [error("quiz_invalid", "Квиз должен содержать title и questions")] }
  }

  const questions: Question[] = []
  for (const raw of candidate.questions) {
    if (!raw || typeof raw !== "object") continue
    const question = raw as Partial<Question>
    if (question.type === "single") {
      questions.push({
        id: String(question.id ?? ""),
        type: "single",
        prompt: String(question.prompt ?? ""),
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        correct: Number(question.correct),
        explanation: String(question.explanation ?? ""),
      })
    } else if (question.type === "text") {
      questions.push({
        id: String(question.id ?? ""),
        type: "text",
        prompt: String(question.prompt ?? ""),
        placeholder: question.placeholder ? String(question.placeholder) : undefined,
        referenceAnswer: String(question.referenceAnswer ?? ""),
        criteria: Array.isArray(question.criteria) ? question.criteria.map(String) : [],
      })
    }
  }

  const quiz: Quiz = { title: candidate.title, questions }
  const errors = validateQuiz(quiz)
  return errors.length ? { quiz: null, errors } : { quiz, errors: [] }
}
