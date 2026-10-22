import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldAlert,
} from "lucide-react"
import { fetchJson } from "../../lib/api"
import type { LessonDetail } from "../../lib/types"
import { FeedbackPanel } from "./FeedbackPanel"
import "./SubmitPanel.css"

export interface SubmitResponse {
  grade: number
  verdict: "pass" | "retry"
  passed: boolean
  feedback: {
    grade: number
    verdict: "pass" | "retry"
    summary: string
    strengths: string[]
    issues: string[]
    nextStep: string
    tasks: Array<{ taskId: string; status: string; comment: string }>
    quiz: Array<{ questionId: string; correct: boolean; comment: string }>
  }
  nextLessonId: string | null
  attempts: number
}

export function SubmitPanel({
  lesson,
  onQuestions,
}: {
  lesson: LessonDetail
  onQuestions?: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const total = lesson.quiz?.questions.length ?? 0
  const answered = useMemo(() => {
    if (!lesson.quiz) return 0
    return lesson.quiz.questions.filter((question) => {
      const answer = lesson.answers[question.id]
      return answer !== undefined && answer !== ""
    }).length
  }, [lesson.answers, lesson.quiz])
  const ready = total > 0 && answered === total

  const submit = async () => {
    if (!ready || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetchJson<SubmitResponse>(`/api/lessons/${lesson.id}/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      setResult(response)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["course"] }),
        queryClient.invalidateQueries({ queryKey: ["lesson", lesson.id] }),
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
      ])
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "mentor_invalid_json"
          ? "Наставник вернул невалидный разбор. Доступ не изменён — попробуй сдать ещё раз."
          : "Не удалось получить разбор наставника. Доступ не изменён.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <FeedbackPanel
        result={result}
        onRetry={() => setResult(null)}
      />
    )
  }

  return (
    <section className="submit-panel" aria-label="Сдача урока">
      <div className="submit-panel__copy">
        <span className="section-kicker">
          <Send size={13} aria-hidden /> финальный шаг
        </span>
        <h3>Готов сдать урок?</h3>
        <p>
          Наставник проверит код, вывод и ответы на вопросы. Оценка 4+ откроет следующую
          папку. До сдачи можно всё менять.
        </p>
        <div className="submit-readiness">
          <span className={answered === total ? "done" : ""}>
            {answered === total ? <CheckCircle2 size={12} aria-hidden /> : <CircleAlert size={12} aria-hidden />}
            вопросы: {answered} / {total}
          </span>
          <span className="done">
            <CheckCircle2 size={12} aria-hidden /> задания: {lesson.tasks.length}
          </span>
        </div>
        {!ready && total > 0 && (
          <button type="button" className="submit-panel__questions" onClick={onQuestions}>
            Ответить на вопросы <ArrowRight size={13} aria-hidden />
          </button>
        )}
        {total === 0 && (
          <p className="submit-panel__missing">
            В этом уроке пока нет квиза — сдача станет доступна после обновления материала.
          </p>
        )}
      </div>
      <div className="submit-panel__action">
        <button
          type="button"
          className="submit-button"
          onClick={() => void submit()}
          disabled={!ready || submitting}
        >
          {submitting ? <LoaderCircle size={14} className="spin" aria-hidden /> : <ShieldAlert size={14} aria-hidden />}
          {submitting ? "Наставник проверяет…" : "Сдать урок"}
        </button>
        {error && (
          <div className="submit-error">
            <CircleAlert size={12} aria-hidden />
            {error}
          </div>
        )}
      </div>
    </section>
  )
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="submit-panel__retry" onClick={onClick}>
      <RotateCcw size={13} aria-hidden /> Доработать и сдать снова
    </button>
  )
}
