import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react"
import {
  cancelCourseJob,
  clarifyCourse,
  fetchCourseJob,
  LOCAL_FALLBACK_QUESTIONS,
  startCourseGeneration,
  type ClarifyQuestion,
  type CourseJob,
  type Volume,
} from "../../lib/courseBuilder"
import "../settings/SettingsPage.css"
import "./CourseWizard.css"

type Step = "topic" | "clarify" | "generate" | "done"

const EXAMPLES = [
  "экономика для жизни",
  "философия стоицизма",
  "Python с нуля",
  "математический анализ",
]

const VOLUMES: Array<{ value: Volume; label: string; hint: string }> = [
  { value: "short", label: "Короткий", hint: "2–3 урока, быстрый вход" },
  { value: "medium", label: "Средний", hint: "4–6 уроков, основной маршрут" },
  { value: "long", label: "Длинный", hint: "8–12+ уроков, если тема обширная" },
]

const TERMINAL: CourseJob["status"][] = ["done", "error", "cancelled"]

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function CourseWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("topic")
  const [topic, setTopic] = useState("")
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([])
  const [fallback, setFallback] = useState(false)
  const [loadingClarify, setLoadingClarify] = useState(false)
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [volume, setVolume] = useState<Volume>("medium")
  const [starting, setStarting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<CourseJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep("topic")
    setTopic("")
    setQuestions([])
    setFallback(false)
    setLoadingClarify(false)
    setSelected({})
    setCustom({})
    setVolume("medium")
    setStarting(false)
    setJobId(null)
    setJob(null)
    setError(null)
    setCancelling(false)
  }, [open])

  const terminal = job ? TERMINAL.includes(job.status) : false
  const canClose = step !== "generate" || Boolean(error) || terminal

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canClose) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, canClose, onClose])

  useEffect(() => {
    if (!open || step !== "generate" || !jobId) return
    let stopped = false
    let timer: number | undefined
    const tick = async () => {
      try {
        const next = await fetchCourseJob(jobId)
        if (stopped) return
        setJob(next)
        if (next.status === "done") {
          void queryClient.invalidateQueries({ queryKey: ["courses"] })
          void queryClient.invalidateQueries({ queryKey: ["project"] })
          void queryClient.invalidateQueries({ queryKey: ["course"] })
          setStep("done")
          return
        }
        if (next.status === "error") {
          setError(next.error || "Сборка завершилась с ошибкой.")
          return
        }
        if (next.status === "cancelled") return
        timer = window.setTimeout(() => void tick(), 1000)
      } catch (cause) {
        if (!stopped) setError(errorText(cause))
      }
    }
    void tick()
    return () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
    }
  }, [open, step, jobId, queryClient])

  const answers = useMemo(
    () =>
      questions.flatMap((question) => {
        const parts = [...(selected[question.id] ?? [])]
        const own = (custom[question.id] ?? "").trim()
        if (own) parts.push(own)
        const answer = parts.join("; ")
        return answer ? [{ question: question.prompt, answer }] : []
      }),
    [questions, selected, custom],
  )

  if (!open) return null

  async function goClarify() {
    const value = topic.trim()
    if (!value) return
    setStep("clarify")
    setLoadingClarify(true)
    setError(null)
    setQuestions([])
    setFallback(false)
    try {
      const data = await clarifyCourse(value)
      if (data.questions.length > 0) {
        setQuestions(data.questions)
        setFallback(Boolean(data.fallback))
      } else {
        setQuestions(LOCAL_FALLBACK_QUESTIONS)
        setFallback(true)
      }
    } catch {
      setQuestions(LOCAL_FALLBACK_QUESTIONS)
      setFallback(true)
    } finally {
      setLoadingClarify(false)
    }
  }

  async function generate() {
    setStep("generate")
    setStarting(true)
    setJobId(null)
    setJob(null)
    setError(null)
    try {
      const result = await startCourseGeneration({
        topic: topic.trim(),
        answers,
        volume,
      })
      setJobId(result.jobId)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setStarting(false)
    }
  }

  async function cancel() {
    if (!jobId || cancelling) return
    setCancelling(true)
    try {
      await cancelCourseJob(jobId)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setCancelling(false)
    }
  }

  function toggleOption(question: ClarifyQuestion, option: string) {
    setSelected((current) => {
      const values = current[question.id] ?? []
      if (question.type === "single") {
        return { ...current, [question.id]: [option] }
      }
      return {
        ...current,
        [question.id]: values.includes(option)
          ? values.filter((value) => value !== option)
          : [...values, option],
      }
    })
  }

  const title =
    step === "topic"
      ? "Создать курс"
      : step === "clarify"
        ? "Уточним запрос"
        : step === "generate"
          ? "Собираем курс"
          : "Курс готов"

  const progress = job && job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0

  function openCourse() {
    if (!job?.courseId) return
    onClose()
    navigate(`/courses/${job.courseId}`)
  }

  function goHome() {
    onClose()
    navigate("/")
  }

  return (
    <div
      className="wizard-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) onClose()
      }}
    >
      <section
        className="wizard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="wizard-head">
          <div>
            <span className="section-kicker">
              <Sparkles size={13} aria-hidden /> конструктор
            </span>
            <h2 id="wizard-title">{title}</h2>
          </div>
          <button
            type="button"
            className="wizard-close"
            onClick={onClose}
            disabled={!canClose}
            aria-label="Закрыть мастер"
            title={canClose ? "Закрыть" : "Дождитесь сборки или отмените её"}
          >
            <X size={17} aria-hidden />
          </button>
        </header>

        <div className="wizard-steps" aria-hidden>
          {["Тема", "Уточнение", "Сборка"].map((label, index) => {
            const currentIndex = step === "topic" ? 0 : step === "clarify" ? 1 : step === "generate" ? 2 : 3
            const state = index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : ""
            return (
              <span className={`wizard-step ${state}`} key={label}>
                <i>{index < currentIndex ? <Check size={11} /> : index + 1}</i>
                {label}
              </span>
            )
          })}
        </div>

        {step === "topic" && (
          <div className="wizard-body">
            <label className="settings-field">
              <span className="settings-field__label">Чему хотите научиться?</span>
              <textarea
                className="wizard-textarea"
                autoFocus
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Например: хочу разобраться в экономике и научиться читать новости про инфляцию и ставки"
                rows={4}
              />
            </label>
            <div className="wizard-examples">
              {EXAMPLES.map((example) => (
                <button
                  type="button"
                  className="wizard-example"
                  key={example}
                  onClick={() => setTopic(example)}
                >
                  {example}
                </button>
              ))}
            </div>
            <p className="wizard-hint">
              Чем конкретнее запрос, тем точнее курс. Если не знаете, с чего начать,
              напишите тему — конструктор предложит варианты.
            </p>
            <div className="wizard-actions">
              <button
                type="button"
                className="settings-button settings-button--primary"
                disabled={!topic.trim()}
                onClick={() => void goClarify()}
              >
                Продолжить <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        )}

        {step === "clarify" && (
          <div className="wizard-body">
            {loadingClarify ? (
              <div className="wizard-loading" aria-live="polite">
                <LoaderCircle size={20} className="spin" aria-hidden />
                Конструктор придумывает вопросы…
              </div>
            ) : (
              <>
                {fallback && (
                  <p className="wizard-fallback">
                    <TriangleAlert size={14} aria-hidden /> Не удалось получить точные
                    вопросы — вот базовые. Можно выбрать варианты или написать своё.
                  </p>
                )}
                <div className="wizard-questions">
                  {questions.map((question) => (
                    <section className="wizard-question" key={question.id}>
                      <h3>{question.prompt}</h3>
                      <div className="wizard-options">
                        {question.options.map((option) => {
                          const active = (selected[question.id] ?? []).includes(option)
                          return (
                            <label
                              className={`wizard-option${active ? " is-active" : ""}`}
                              key={option}
                            >
                              <input
                                type={question.type === "multiple" ? "checkbox" : "radio"}
                                name={question.id}
                                checked={active}
                                onChange={() => toggleOption(question, option)}
                              />
                              <span>{option}</span>
                            </label>
                          )
                        })}
                      </div>
                      <input
                        className="settings-input wizard-custom"
                        value={custom[question.id] ?? ""}
                        onChange={(event) =>
                          setCustom((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        placeholder="Свой вариант"
                        aria-label={`Свой ответ: ${question.prompt}`}
                      />
                    </section>
                  ))}
                </div>

                <div className="wizard-volume">
                  <span className="settings-field__label">Объём курса</span>
                  <div className="wizard-volume__options">
                    {VOLUMES.map((option) => (
                      <button
                        type="button"
                        className={`wizard-volume__option${volume === option.value ? " is-active" : ""}`}
                        key={option.value}
                        onClick={() => setVolume(option.value)}
                        aria-pressed={volume === option.value}
                      >
                        <b>{option.label}</b>
                        <span>{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wizard-actions">
                  <button
                    type="button"
                    className="settings-button settings-button--ghost"
                    onClick={() => setStep("topic")}
                  >
                    <ArrowLeft size={14} aria-hidden /> Назад
                  </button>
                  <button
                    type="button"
                    className="settings-button settings-button--primary"
                    onClick={() => void generate()}
                  >
                    <Sparkles size={14} aria-hidden /> Собрать курс
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === "generate" && (
          <div className="wizard-body">
            {error ? (
              <div className="wizard-error">
                <TriangleAlert size={18} aria-hidden />
                <div>
                  <b>Сборка не удалась</b>
                  <p>{error}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="wizard-progress">
                  <div className="wizard-progress__top">
                    <span>{job?.phase ?? (starting ? "Запускаем конструктор…" : "Готовим сборку…")}</span>
                    <b>{job && job.total > 0 ? `${job.completed} / ${job.total}` : ""}</b>
                  </div>
                  <div className={`wizard-progress__bar${job && job.total === 0 ? " is-indeterminate" : ""}`}>
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {job?.lessonTitles && job.lessonTitles.length > 0 && (
                  <ol className="wizard-lessons">
                    {job.lessonTitles.map((lesson, index) => (
                      <li
                        className={index < job.completed ? "is-done" : ""}
                        key={`${lesson}-${index}`}
                      >
                        <span className="wizard-lessons__mark">
                          {index < job.completed ? <Check size={11} aria-hidden /> : index + 1}
                        </span>
                        {lesson}
                      </li>
                    ))}
                  </ol>
                )}

                <p className="wizard-hint">
                  Мастер остаётся открытым, пока конструктор пишет уроки. Обычно это
                  занимает несколько минут; можно отменить сборку.
                </p>

                <div className="wizard-actions">
                  <button
                    type="button"
                    className="settings-button settings-button--ghost"
                    onClick={() => void cancel()}
                    disabled={!jobId || cancelling || job?.status === "cancelled"}
                  >
                    {cancelling ? <LoaderCircle size={14} className="spin" aria-hidden /> : <X size={14} aria-hidden />}
                    {cancelling ? "Отменяем…" : "Отменить сборку"}
                  </button>
                </div>
              </>
            )}

            {job?.status === "cancelled" && (
              <>
                <div className="wizard-cancelled">
                  <X size={18} aria-hidden />
                  <span>Сборка отменена. Курс не сохранён.</span>
                </div>
                <div className="wizard-actions">
                  <button type="button" className="settings-button settings-button--ghost" onClick={() => setStep("clarify")}>
                    <ArrowLeft size={14} aria-hidden /> К уточнениям
                  </button>
                  <button type="button" className="settings-button settings-button--primary" onClick={goHome}>
                    На главную
                  </button>
                </div>
              </>
            )}

            {error && (
              <div className="wizard-actions">
                <button type="button" className="settings-button settings-button--ghost" onClick={() => setStep("clarify")}>
                  <ArrowLeft size={14} aria-hidden /> К уточнениям
                </button>
                <button type="button" className="settings-button settings-button--primary" onClick={() => void generate()}>
                  <Sparkles size={14} aria-hidden /> Повторить
                </button>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="wizard-done">
            <span className="wizard-done__icon">
              <CircleCheck size={26} aria-hidden />
            </span>
            <h3>{job?.title ?? "Курс готов"}</h3>
            <p>Карточка появилась на главной. Можно открыть курс и начать первый урок.</p>
            <div className="wizard-actions">
              <button type="button" className="settings-button settings-button--ghost" onClick={goHome}>
                На главную
              </button>
              <button type="button" className="settings-button settings-button--primary" onClick={openCourse}>
                Открыть курс <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
