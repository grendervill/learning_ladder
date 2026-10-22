import { useMemo } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  ListChecks,
  LockKeyhole,
} from "lucide-react"
import { useLesson } from "../../lib/useLesson"
import type { LessonDetail } from "../../lib/types"
import { Markdown } from "../../lib/markdown"
import { PageSkeleton } from "../course/CourseStates"
import { QuizTab } from "../quiz/QuizTab"
import { TheoryTab } from "./TheoryTab"
import "./LessonPage.css"

type Tab = "theory" | "questions" | "practice"

const TAB_LABELS: Record<Tab, string> = {
  theory: "Теория",
  questions: "Вопросы",
  practice: "Практика",
}

function statusLabel(lesson: LessonDetail) {
  if (lesson.access === "passed") return "сдан"
  if (lesson.access === "in_progress") return "в работе"
  return "доступен"
}

export function LessonPage({ lessonId }: { lessonId?: string }) {
  const params = useParams()
  const id = lessonId ?? params.lessonId
  const { data: lesson, isLoading, isError, error, refetch } = useLesson(id)
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get("tab")
  const tab: Tab = rawTab === "questions" || rawTab === "practice" ? rawTab : "theory"
  const setTab = (next: Tab) => setSearchParams(next === "theory" ? {} : { tab: next }, { replace: true })

  const quizCount = lesson?.quiz?.questions.length ?? 0
  const taskCount = lesson?.tasks.length ?? 0
  const panelId = `lesson-panel-${tab}`

  const content = useMemo(() => {
    if (!lesson) return null
    if (tab === "theory") {
      return lesson.theoryMarkdown ? (
        <TheoryTab markdown={lesson.theoryMarkdown} />
      ) : (
        <EmptyPanel title="Теория ещё не добавлена" text="Материал появится, как только его дополнят." />
      )
    }
    if (tab === "questions") {
      return <QuizTab lessonId={lesson.id} onPractice={() => setTab("practice")} />
    }
    return <PracticePreview lesson={lesson} onQuestions={() => setTab("questions")} />
  }, [lesson, tab])

  if (isLoading) return <PageSkeleton label="Открываем урок" />
  if (isError || !lesson) {
    const locked = error instanceof Error && error.message === "lesson_locked"
    return (
      <div className="lesson-error">
        <span className="lesson-error__icon">
          {locked ? <LockKeyhole size={19} /> : <AlertTriangle size={19} />}
        </span>
        <p className="lesson-error__kicker">{locked ? "Закрытый урок" : "Ошибка"}</p>
        <h1>{locked ? "Сначала закрой предыдущий шаг" : "Не удалось открыть урок"}</h1>
        <p>
          {locked
            ? "Следующая папка открывается после сдачи текущей на 4+."
            : "Проверь локальный сервер и попробуй снова."}
        </p>
        <div className="lesson-error__actions">
          {!locked && (
            <button type="button" onClick={() => refetch()}>
              Повторить
            </button>
          )}
          <Link to="/">
            <ArrowLeft size={14} aria-hidden /> К программе
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-page">
      <div className="lesson-breadcrumb">
        <Link to="/">Программа</Link>
        <span>/</span>
        <span>{lesson.chapterTitle ?? "Урок"}</span>
        <span>/</span>
        <b>{lesson.title}</b>
      </div>

      <header className="lesson-head">
        <div className="lesson-head__copy">
          <div className="lesson-kicker">
            <span className="lesson-kicker__line" />
            урок · {statusLabel(lesson)}
          </div>
          <h1>{lesson.title}</h1>
          <p className="lesson-deck">
            {lesson.chapterTitle ? `${lesson.chapterTitle}. ` : ""}
            Читай спокойно, проверяй руками и не спеши сдавать.
          </p>
        </div>
        <div className="lesson-meta" aria-label="Состав урока">
          <span>
            <BookOpen size={14} aria-hidden /> теория
          </span>
          <span>
            <ListChecks size={14} aria-hidden /> {quizCount} вопросов
          </span>
          <span>
            <Code2 size={14} aria-hidden /> {taskCount} заданий
          </span>
        </div>
      </header>

      {lesson.errors.length > 0 && (
        <div className="lesson-warning">
          <AlertTriangle size={14} aria-hidden />
          <span>
            В материале есть замечания: {lesson.errors.map((item) => item.message).join(" ")}
          </span>
        </div>
      )}

      <div className="lesson-tabs" role="tablist" aria-label="Разделы урока">
        {(Object.keys(TAB_LABELS) as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`lesson-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`lesson-panel-${item}`}
            aria-label={TAB_LABELS[item]}
            className={`lesson-tab${tab === item ? " is-active" : ""}`}
            onClick={() => setTab(item)}
          >
            {TAB_LABELS[item]}
            {item === "questions" && <span className="lesson-tab__count">{quizCount}</span>}
            {item === "practice" && <span className="lesson-tab__count">{taskCount}</span>}
          </button>
        ))}
      </div>

      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={`lesson-tab-${tab}`}
        className="lesson-panel"
      >
        {content}
      </section>

      <div className="lesson-next">
        {tab === "theory" && (
          <button type="button" onClick={() => setTab("questions")}>
            К вопросам <ArrowRight size={14} aria-hidden />
          </button>
        )}
        {tab === "questions" && (
          <button type="button" onClick={() => setTab("practice")}>
            К практике <ArrowRight size={14} aria-hidden />
          </button>
        )}
        {tab === "practice" && (
          <span className="lesson-next__note">
            Проверь код локально, затем сдай урок наставнику.
          </span>
        )}
      </div>
    </div>
  )
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-panel">
      <span className="empty-panel__icon">
        <BookOpen size={18} aria-hidden />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  )
}

function PracticePreview({ lesson, onQuestions }: { lesson: LessonDetail; onQuestions: () => void }) {
  return (
    <div className="practice-preview">
      <div className="practice-preview__head">
        <div>
          <span className="section-kicker">
            <Code2 size={13} aria-hidden /> практика
          </span>
          <h2>Пора писать код</h2>
          <p>
            Редактор, запуск и проверка подключаются здесь. Пока посмотри, что предстоит сделать.
          </p>
        </div>
        {lesson.practiceIntro && (
          <div className="practice-intro">
            <Markdown markdown={lesson.practiceIntro} />
          </div>
        )}
      </div>
      <div className="task-preview-list">
        {lesson.tasks.map((task, index) => (
          <article className="task-preview" key={task.id}>
            <span className="task-preview__num">{String(index + 1).padStart(2, "0")}</span>
            <div className="task-preview__body">
              <h3>{task.title}</h3>
              <p>{task.prompt.split("\n").slice(0, 2).join(" ")}</p>
              <div className="task-preview__files">
                {task.files.map((file) => (
                  <span key={file.name}>{file.name}</span>
                ))}
                <span className="task-preview__kind">
                  {task.kind === "terminal" ? "терминал" : task.kind === "love" ? "LÖVE" : "Lua"}
                </span>
              </div>
            </div>
            <span className="task-preview__state">не начато</span>
          </article>
        ))}
      </div>
      <div className="preview-actions">
        <button type="button" className="preview-actions__ghost" onClick={onQuestions}>
          Вернуться к вопросам
        </button>
      </div>
    </div>
  )
}
