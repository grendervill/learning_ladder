import { useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Check, CircleAlert, GraduationCap, LoaderCircle } from "lucide-react"
import { useLesson } from "../../lib/useLesson"
import { fetchJson } from "../../lib/api"
import { QuestionCard } from "./QuestionCard"
import { SubmitPanel } from "../practice/SubmitPanel"
import "./QuizTab.css"

type SaveState = "idle" | "saving" | "saved" | "error"

export function QuizTab({
  lessonId,
  onPractice,
  practice = false,
}: {
  lessonId: string
  onPractice?: () => void
  practice?: boolean
}) {
  const { data: lesson, isLoading, isError, refetch } = useLesson(lessonId)
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const initialized = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (lesson && !initialized.current) {
      setAnswers(lesson.answers ?? {})
      initialized.current = true
    }
  }, [lesson])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const answered = useMemo(
    () =>
      lesson?.quiz
        ? lesson.quiz.questions.filter((question) => {
            const value = answers[question.id]
            return value !== undefined && value !== ""
          }).length
        : 0,
    [answers, lesson],
  )

  const save = async (nextAnswers: Record<string, number | string>) => {
    setSaveState("saving")
    try {
      await fetchJson(`/api/lessons/${lessonId}/quiz-answers`, {
        method: "PUT",
        body: JSON.stringify({ answers: nextAnswers }),
      })
      queryClient.setQueryData(["lesson", lessonId], (current: any) =>
        current ? { ...current, answers: nextAnswers } : current,
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

  if (isLoading) {
    return (
      <div className="quiz-loading" aria-busy="true">
        <LoaderCircle size={17} className="spin" aria-hidden />
        Загружаем вопросы
      </div>
    )
  }

  if (isError || !lesson) {
    return (
      <div className="quiz-empty">
        <CircleAlert size={18} aria-hidden />
        <h2>Не удалось загрузить вопросы</h2>
        <button type="button" onClick={() => refetch()}>
          Повторить
        </button>
      </div>
    )
  }

  if (!lesson.quiz) {
    return (
      <div className="quiz-empty">
        <GraduationCap size={18} aria-hidden />
        <h2>Вопросы ещё не добавлены</h2>
        <p>Квиз появится вместе со следующим обновлением материала.</p>
      </div>
    )
  }

  const total = lesson.quiz.questions.length
  const percent = total ? Math.round((answered / total) * 100) : 0

  return (
    <>
      <div className="quiz-layout">
        <div className="quiz-main">
          <header className="quiz-head">
            <span className="section-kicker">
              <GraduationCap size={13} aria-hidden /> {practice ? "практика" : "проверь себя"}
            </span>
            <h2>{lesson.quiz.title}</h2>
            <p>
              {practice
                ? "Ответь на тестовые вопросы и развёрнутые задания. Наставник проверит понимание и разберёт ответы."
                : "Смешанный квиз: тесты и письменные ответы. Разбор появится после сдачи урока."}
            </p>
            <div className="quiz-progress" aria-label={`Отвечено ${answered} из ${total}`}>
              <div className="quiz-progress__labels">
                <span>отвечено {answered} из {total}</span>
                <b>{percent}%</b>
              </div>
              <div className="quiz-progress__bar">
                <i style={{ width: `${percent}%` }} />
              </div>
            </div>
          </header>

          <div className="quiz-questions">
            {lesson.quiz.questions.map((question, index) => (
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
              {saveState === "saving" && <LoaderCircle size={12} className="spin" aria-hidden />}
              {saveState === "saved" && <Check size={12} aria-hidden />}
              {saveState === "error" && <CircleAlert size={12} aria-hidden />}
              <span>
                {saveState === "saving"
                  ? "сохраняем"
                  : saveState === "saved"
                    ? "сохранено"
                    : saveState === "error"
                      ? "не сохранено"
                      : "черновик"}
              </span>
            </div>
          </div>
          <p className="quiz-rail__note">
            Не спеши: ответы можно менять до сдачи. Правильные варианты откроются только после
            проверки наставником.
          </p>
          {!practice && onPractice && (
            <button type="button" className="quiz-rail__next" onClick={onPractice}>
              К практике <ArrowRight size={14} aria-hidden />
            </button>
          )}
        </aside>
      </div>
      {practice && <SubmitPanel lesson={lesson} />}
    </>
  )
}
