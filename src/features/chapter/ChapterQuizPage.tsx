import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"
import { fetchJson } from "../../lib/api"
import { useChapterQuiz } from "../../lib/useChapterQuiz"
import type { SubmitResponse } from "../practice/SubmitPanel"
import { FeedbackPanel } from "../practice/FeedbackPanel"
import { QuestionCard } from "../quiz/QuestionCard"
import "../quiz/QuizTab.css"
import "./ChapterQuizPage.css"

type SaveState = "idle" | "saving" | "saved" | "error"

export function ChapterQuizPage() {
  const { chapterId, courseId: routeCourseId } = useParams()
  const { data, isLoading, isError, error, refetch } = useChapterQuiz(chapterId)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const initialized = useRef(false)
  const timer = useRef<number | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (data && !initialized.current) {
      setAnswers(data.answers ?? {})
      initialized.current = true
    }
  }, [data])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const total = data?.quiz.questions.length ?? 0
  const answered = useMemo(
    () =>
      data?.quiz.questions.filter((question) => {
        const value = answers[question.id]
        return value !== undefined && value !== ""
      }).length ?? 0,
    [answers, data],
  )

  const save = async (next: Record<string, number | string>) => {
    if (!chapterId) return
    setSaveState("saving")
    try {
      await fetchJson(`/api/chapters/${chapterId}/quiz-answers`, {
        method: "PUT",
        body: JSON.stringify({ answers: next }),
      })
      queryClient.setQueryData(["chapter-quiz", chapterId], (current: any) =>
        current ? { ...current, answers: next } : current,
      )
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }

  const updateAnswer = (questionId: string, value: number | string) => {
    const next = { ...answers, [questionId]: value }
    setAnswers(next)
    if (timer.current) window.clearTimeout(timer.current)
    setSaveState("saving")
    timer.current = window.setTimeout(() => void save(next), 450)
  }

  const submit = async () => {
    if (!chapterId || submitting || answered !== total) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetchJson<SubmitResponse>(`/api/chapters/${chapterId}/quiz/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      setResult(response)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["course"] }),
        queryClient.invalidateQueries({ queryKey: ["courses"] }),
        queryClient.invalidateQueries({ queryKey: ["progress"] }),
        queryClient.invalidateQueries({ queryKey: ["chapter-quiz", chapterId] }),
      ])
    } catch {
      setSubmitError("Не удалось получить разбор. Доступ не изменён — попробуй ещё раз.")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="chapter-loading">
        <LoaderCircle size={17} className="spin" aria-hidden /> Загружаем квиз главы
      </div>
    )
  }

  if (isError || !data) {
    const locked = error instanceof Error && error.message === "chapter_quiz_locked"
    return (
      <div className="chapter-locked">
        <span className="chapter-locked__icon">
          {locked ? <ShieldCheck size={20} /> : <CircleAlert size={20} />}
        </span>
        <p className="chapter-locked__kicker">{locked ? "Квиз закрыт" : "Ошибка"}</p>
        <h1>{locked ? "Сначала закрой все уроки главы" : "Не удалось открыть квиз"}</h1>
        <p>
          {locked
            ? "Общий квиз становится доступен после сдачи всех папок главы на 4+."
            : "Проверь сервер и попробуй снова."}
        </p>
        <Link to={routeCourseId ? `/courses/${routeCourseId}` : "/"}>
          <ArrowLeft size={14} aria-hidden /> Вернуться к курсу
        </Link>
      </div>
    )
  }

  if (result) {
    return (
      <div className="chapter-quiz-page">
        <FeedbackPanel
          result={result}
          kind="chapter"
          courseId={data.courseId}
          onRetry={() => {
            setResult(null)
            void refetch()
          }}
        />
      </div>
    )
  }

  const percent = total ? Math.round((answered / total) * 100) : 0

  return (
    <div className="chapter-quiz-page">
      <Link to={`/courses/${data.courseId}`} className="chapter-back">
        <ArrowLeft size={14} aria-hidden /> {data.courseTitle || "Курс"}
      </Link>
      <header className="chapter-head">
        <span className="section-kicker">
          <GraduationCap size={13} aria-hidden /> общий квиз главы
        </span>
        <h1>{data.title}</h1>
        <p>{data.description || "Собери всё, что прошёл в главе, и проверь понимание целиком."}</p>
        {data.passed && (
          <span className="chapter-passed-note">
            <ShieldCheck size={13} aria-hidden /> Глава уже закрыта. Можно пересдать для улучшения.
          </span>
        )}
      </header>

      <div className="quiz-layout">
        <div className="quiz-main">
          <div className="quiz-progress" aria-label={`Отвечено ${answered} из ${total}`}>
            <div className="quiz-progress__labels">
              <span>отвечено {answered} из {total}</span>
              <b>{percent}%</b>
            </div>
            <div className="quiz-progress__bar">
              <i style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className="quiz-questions">
            {data.quiz.questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                value={answers[question.id]}
                onChange={(value) => updateAnswer(question.id, value)}
              />
            ))}
          </div>
        </div>
        <aside className="quiz-rail">
          <div className="quiz-rail__card">
            <span className="quiz-rail__label">готовность</span>
            <strong>
              {answered}
              <small> / {total}</small>
            </strong>
            <div className="quiz-rail__line">
              <i style={{ width: `${percent}%` }} />
            </div>
            <div className={`quiz-save quiz-save--${saveState}`}>
              {saveState === "saved" && <ShieldCheck size={12} aria-hidden />}
              <span>{saveState === "saved" ? "сохранено" : saveState === "saving" ? "сохраняем" : "черновик"}</span>
            </div>
          </div>
          <p className="quiz-rail__note">
            Оценка 4+ откроет первую папку следующей главы. Вопросы можно менять до сдачи.
          </p>
          <button
            type="button"
            className="chapter-submit"
            onClick={() => void submit()}
            disabled={answered !== total || submitting}
          >
            {submitting ? <LoaderCircle size={13} className="spin" aria-hidden /> : <ArrowRight size={13} aria-hidden />}
            {submitting ? "Проверяем…" : "Сдать главу"}
          </button>
          {submitError && (
            <div className="chapter-submit-error">
              <CircleAlert size={11} aria-hidden /> {submitError}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
