import { useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  LoaderCircle,
  RefreshCw,
  Save,
  Settings2,
  TriangleAlert,
} from "lucide-react"
import { PageSkeleton } from "../course/CourseStates"
import {
  saveCourseMentorPrompt,
  saveCourseSettings,
  useCourseChecks,
  useCourseMentorPrompt,
  useCourseSettings,
} from "../../lib/courseSettings"
import {
  ICON_OPTIONS,
  MODE_OPTIONS,
  RUNTIME_OPTIONS,
  RUNTIME_PRESETS,
  THEME_OPTIONS,
} from "../../lib/courseOptions"
import type { CourseIcon, CourseMode, CourseTheme, RuntimeKind } from "../../lib/types"
import "../settings/SettingsPage.css"
import "./CourseSettingsPage.css"

interface FormState {
  title: string
  description: string
  theme: CourseTheme
  icon: CourseIcon
  mode: CourseMode
  runtime: RuntimeKind
  runCommand: string
  lspCommand: string
  lspArgs: string
  fileExtension: string
  entry: string
  mentorPrompt: string
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  theme: "forest",
  icon: "book",
  mode: "general",
  runtime: "none",
  runCommand: "",
  lspCommand: "",
  lspArgs: "",
  fileExtension: ".txt",
  entry: "main.txt",
  mentorPrompt: "",
}

function statusIcon(status: "ok" | "warn" | "fail") {
  if (status === "ok") return <CircleCheck size={16} aria-hidden />
  if (status === "warn") return <TriangleAlert size={16} aria-hidden />
  return <CircleX size={16} aria-hidden />
}

export function CourseSettingsPage() {
  const { courseId } = useParams()
  const settings = useCourseSettings(courseId)
  const mentor = useCourseMentorPrompt(courseId)
  const checks = useCourseChecks(courseId)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [initialized, setInitialized] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    setInitialized(false)
    setSavedAt(null)
  }, [courseId])

  useEffect(() => {
    if (!settings.data || !mentor.data || initialized) return
    const course = settings.data.course
    setForm({
      title: course.title,
      description: course.description,
      theme: course.theme,
      icon: course.icon,
      mode: course.mode,
      runtime: course.settings.runtime,
      runCommand: course.settings.runCommand,
      lspCommand: course.settings.lspCommand,
      lspArgs: course.settings.lspArgs.join(" "),
      fileExtension: course.settings.fileExtension,
      entry: course.settings.entry,
      mentorPrompt: mentor.data.prompt,
    })
    setInitialized(true)
  }, [settings.data, mentor.data, initialized])

  const save = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error("course_missing")
      await saveCourseSettings(courseId, {
        title: form.title.trim(),
        description: form.description,
        theme: form.theme,
        icon: form.icon,
        mode: form.mode,
        settings: {
          runtime: form.runtime,
          runCommand: form.runCommand,
          lspCommand: form.lspCommand,
          lspArgs: form.lspArgs.split(/\s+/).filter(Boolean),
          fileExtension: form.fileExtension,
          entry: form.entry,
        },
      })
      await saveCourseMentorPrompt(courseId, form.mentorPrompt)
    },
    onSuccess: () => {
      if (!courseId) return
      void queryClient.invalidateQueries({ queryKey: ["course-settings", courseId] })
      void queryClient.invalidateQueries({ queryKey: ["course-mentor-prompt", courseId] })
      void queryClient.invalidateQueries({ queryKey: ["course-checks", courseId] })
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] })
      void queryClient.invalidateQueries({ queryKey: ["courses"] })
      setSavedAt(Date.now())
    },
  })

  if (settings.isLoading || mentor.isLoading) {
    return <PageSkeleton label="Открываем настройки курса" />
  }

  if (settings.isError || mentor.isError || !settings.data || !mentor.data) {
    return (
      <div className="course-settings-page">
        <div className="settings-error">
          <p>Не удалось загрузить настройки курса.</p>
          <button
            type="button"
            className="settings-button settings-button--ghost"
            onClick={() => {
              void settings.refetch()
              void mentor.refetch()
            }}
          >
            Повторить
          </button>
          <Link to={courseId ? `/courses/${courseId}` : "/"}>Вернуться к курсу</Link>
        </div>
      </div>
    )
  }

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setSavedAt(null)
  }

  const applyPreset = () => {
    const preset = RUNTIME_PRESETS[form.runtime]
    setForm((current) => ({
      ...current,
      runCommand: preset.runCommand,
      lspCommand: preset.lspCommand,
      lspArgs: preset.lspArgs.join(" "),
      fileExtension: preset.fileExtension,
      entry: preset.entry,
    }))
    setSavedAt(null)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.mentorPrompt.trim()) return
    save.mutate()
  }

  return (
    <div className="course-settings-page">
      <div className="course-settings-nav">
        <Link to={`/courses/${courseId}`}>
          <ArrowLeft size={14} aria-hidden /> К курсу
        </Link>
        <span>настройки курса</span>
      </div>

      <header className="course-settings-head">
        <span className="section-kicker">
          <Settings2 size={13} aria-hidden /> курс
        </span>
        <h1>Настройки курса</h1>
        <p>
          Карточка, наставник и практика этого курса. Всё остальное — в общих настройках
          программы.
        </p>
      </header>

      <form className="course-settings-form" onSubmit={onSubmit}>
        <section className="course-settings-section">
          <div className="course-settings-section__head">
            <h2>Карточка</h2>
            <p>Как курс выглядит на главной и в списке.</p>
          </div>
          <div className="course-settings-grid">
            <label className="settings-field">
              <span className="settings-field__label">Название</span>
              <input
                className="settings-input"
                value={form.title}
                onChange={(event) => update("title", event.target.value)}
                required
              />
            </label>
            <label className="settings-field">
              <span className="settings-field__label">Тема</span>
              <select
                className="settings-input"
                value={form.theme}
                onChange={(event) => update("theme", event.target.value as CourseTheme)}
              >
                {THEME_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field__label">Иконка</span>
              <select
                className="settings-input"
                value={form.icon}
                onChange={(event) => update("icon", event.target.value as CourseIcon)}
              >
                {ICON_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span className="settings-field__label">Режим практики</span>
              <select
                className="settings-input"
                value={form.mode}
                onChange={(event) => {
                  const mode = event.target.value as CourseMode
                  setForm((current) => ({
                    ...current,
                    mode,
                    ...(mode === "programming" ? {} : { runtime: "none" as RuntimeKind }),
                  }))
                  setSavedAt(null)
                }}
              >
                {MODE_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="settings-field">
            <span className="settings-field__label">Описание</span>
            <textarea
              className="course-settings-textarea"
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              rows={3}
              placeholder="Чему научится человек и зачем ему это."
            />
          </label>
        </section>

        <section className="course-settings-section">
          <div className="course-settings-section__head">
            <h2>Наставник</h2>
            <p>Правила, которые применяются только внутри этого курса.</p>
          </div>
          <textarea
            className="mentor-textarea course-settings-mentor"
            value={form.mentorPrompt}
            spellCheck={false}
            onChange={(event) => update("mentorPrompt", event.target.value)}
            aria-label="Промпт наставника курса"
          />
          <div className="mentor-meta">
            <span>{form.mentorPrompt.length} символов</span>
            {mentor.data.path && <span className="mentor-meta__path">{mentor.data.path}</span>}
          </div>
        </section>

        <section className="course-settings-section">
          <div className="course-settings-section__head">
            <h2>Практика</h2>
            <p>Язык, запуск и подсказки редактора для заданий с кодом.</p>
          </div>
          <div className="course-settings-grid">
            <label className="settings-field">
              <span className="settings-field__label">Среда</span>
              <select
                className="settings-input"
                value={form.runtime}
                onChange={(event) => update("runtime", event.target.value as RuntimeKind)}
              >
                {RUNTIME_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="course-settings-preset">
              <span className="settings-field__label">Пресет</span>
              <button type="button" className="settings-button settings-button--ghost" onClick={applyPreset}>
                Подставить команды
              </button>
            </div>
          </div>

          {form.runtime === "none" ? (
            <p className="settings-field__hint">
              Запуск кода выключен. Практика будет письменной или в формате квиза 50/50.
            </p>
          ) : (
            <div className="course-settings-grid course-settings-grid--commands">
              <label className="settings-field">
                <span className="settings-field__label">Команда запуска</span>
                <input
                  className="settings-input"
                  value={form.runCommand}
                  onChange={(event) => update("runCommand", event.target.value)}
                  placeholder="python3 {file}"
                />
              </label>
              <label className="settings-field">
                <span className="settings-field__label">Команда LSP</span>
                <input
                  className="settings-input"
                  value={form.lspCommand}
                  onChange={(event) => update("lspCommand", event.target.value)}
                  placeholder="clangd"
                />
              </label>
              <label className="settings-field">
                <span className="settings-field__label">Аргументы LSP</span>
                <input
                  className="settings-input"
                  value={form.lspArgs}
                  onChange={(event) => update("lspArgs", event.target.value)}
                  placeholder="--stdio"
                />
              </label>
              <label className="settings-field">
                <span className="settings-field__label">Расширение</span>
                <input
                  className="settings-input"
                  value={form.fileExtension}
                  onChange={(event) => update("fileExtension", event.target.value)}
                  placeholder=".py"
                />
              </label>
              <label className="settings-field">
                <span className="settings-field__label">Главный файл</span>
                <input
                  className="settings-input"
                  value={form.entry}
                  onChange={(event) => update("entry", event.target.value)}
                  placeholder="main.py"
                />
              </label>
            </div>
          )}
        </section>

        <div className="settings-actions course-settings-save">
          <button
            type="submit"
            className="settings-button settings-button--primary"
            disabled={save.isPending || !form.title.trim() || !form.mentorPrompt.trim()}
          >
            {save.isPending ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Save size={14} aria-hidden />}
            {save.isPending ? "Сохраняем…" : "Сохранить настройки"}
          </button>
          {savedAt !== null && (
            <span className="settings-saved">
              <CircleCheck size={14} aria-hidden /> Сохранено
            </span>
          )}
          {save.isError && (
            <span className="settings-save-error">Не удалось сохранить: {save.error.message}</span>
          )}
        </div>
      </form>

      <section className="course-settings-section course-settings-checks">
        <div className="course-settings-section__head">
          <h2>Проверки курса</h2>
          <button
            type="button"
            className="settings-button settings-button--ghost"
            onClick={() => void checks.refetch()}
            disabled={checks.isFetching}
          >
            <RefreshCw size={14} className={checks.isFetching ? "spin" : undefined} aria-hidden />
            {checks.isFetching ? "Проверяем…" : "Проверить снова"}
          </button>
        </div>
        {checks.isLoading && <div className="check-skeleton" />}
        {checks.isError && <p className="settings-save-error">Не удалось выполнить проверки.</p>}
        {checks.data && (
          <div className="course-checks">
            {checks.data.checks.map((check) => (
              <div className={`course-check course-check--${check.status}`} key={check.id}>
                <span className="course-check__icon">{statusIcon(check.status)}</span>
                <div>
                  <b>{check.label}</b>
                  <span>{check.detail}</span>
                  {check.hint && <small>{check.hint}</small>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
