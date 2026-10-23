import { Link, NavLink, useLocation } from "react-router-dom"
import {
  ArrowLeft,
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  Circle,
  GraduationCap,
  LoaderCircle,
  Lock,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { fetchJson } from "../lib/api"
import { plural } from "../lib/plural"
import { useCourse } from "../lib/useCourse"
import { useCourses } from "../lib/useCourses"
import { useSession } from "../features/session/SessionContext"
import type { LessonStatus } from "../lib/types"
import { ThemeToggle } from "./ThemeToggle"
import "./Sidebar.css"

function statusLabel(status: LessonStatus) {
  if (status === "passed") return "сдано"
  if (status === "in_progress") return "в работе"
  if (status === "available") return "доступно"
  return "закрыто"
}

function LessonNode({ status }: { status: LessonStatus }) {
  if (status === "passed") {
    return (
      <span className="lesson-node lesson-node--passed" aria-hidden>
        <Check size={10} strokeWidth={2.4} />
      </span>
    )
  }
  if (status === "locked") {
    return (
      <span className="lesson-node lesson-node--locked" aria-hidden>
        <Lock size={9} strokeWidth={2} />
      </span>
    )
  }
  return (
    <span className={`lesson-node lesson-node--${status}`} aria-hidden>
      {status === "in_progress" && <i />}
    </span>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation()
  const match = location.pathname.match(/^\/courses\/([^/]+)/)
  const courseId = match?.[1]
  const currentQuery = useCourse(courseId)
  const coursesQuery = useCourses("", 1)
  const current = courseId ? currentQuery.data : undefined
  const courses = coursesQuery.data?.courses ?? []
  const { active: sessionActive, ending: sessionEnding, endSession } = useSession()
  const queryClient = useQueryClient()

  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const lessonsById = new Map((current?.lessons ?? []).map((lesson) => [lesson.id, lesson]))
  const passedLessons = current?.progress?.passed ?? 0
  const totalLessons = current?.progress?.total ?? current?.lessons.length ?? 0
  const progress = current?.progress?.percent ?? (totalLessons ? Math.round((passedLessons / totalLessons) * 100) : 0)
  const courseCount = coursesQuery.data?.total ?? courses.length

  return (
    <>
      <aside className={`sidebar${open ? " sidebar--open" : ""}`} aria-label="Программа обучения">
        <Link to="/" className="sidebar-brand">
          <div className="moon-mark" aria-hidden>
            <span />
          </div>
          <div>
            <strong>Лестница обучения</strong>
            <small>курсы, собранные под тебя</small>
          </div>
        </Link>

        <div className="sidebar-progress">
          <div className="sidebar-progress__top">
            <span>{courseId ? "Прогресс курса" : "Курсы"}</span>
            <b>{courseId ? `${progress}%` : courseCount}</b>
          </div>
          {courseId && (
            <div className="sidebar-progress__bar" aria-hidden>
              <i style={{ width: `${progress}%` }} />
            </div>
          )}
          <small>
            {courseId
              ? `${passedLessons} из ${totalLessons} ${plural(totalLessons, ["урока", "уроков", "уроков"])}`
              : `${courseCount} ${plural(courseCount, ["курс", "курса", "курсов"])} в проекте`}
          </small>
        </div>

        <nav className="sidebar-nav">
          {!courseId && coursesQuery.isLoading && (
            <div className="sidebar-skeleton" aria-label="Загрузка курсов">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}

          {!courseId && coursesQuery.isError && (
            <p className="sidebar-error">Не удалось загрузить курсы.</p>
          )}

          {!courseId && !coursesQuery.isLoading && !coursesQuery.isError && (
            <div className="sidebar-course-list">
              <div className="sidebar-chapter__head">
                <span>Все курсы</span>
                <span>{courseCount}</span>
              </div>
              {courses.map((course) => (
                <NavLink
                  to={`/courses/${course.id}`}
                  className="sidebar-course-link"
                  key={course.id}
                >
                  <span className={`sidebar-course-dot sidebar-course-dot--${course.theme}`} aria-hidden />
                  <span className="sidebar-course-title">{course.title}</span>
                  <span className="sidebar-course-percent">{course.progress.percent}%</span>
                </NavLink>
              ))}
              <Link to="/settings?tab=create" className="sidebar-create-link">
                <Plus size={13} aria-hidden /> Создать курс
              </Link>
            </div>
          )}

          {courseId && currentQuery.isLoading && (
            <div className="sidebar-skeleton" aria-label="Загрузка программы">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}

          {courseId && currentQuery.isError && (
            <p className="sidebar-error">
              Не удалось загрузить курс. <Link to="/">Все курсы</Link>
            </p>
          )}

          {courseId && current && (
            <>
              <Link to="/" className="sidebar-back">
                <ArrowLeft size={13} aria-hidden /> Все курсы
              </Link>
              {current.chapters.map((chapter, chapterIndex) => {
                const passedInChapter = chapter.lessonIds.filter(
                  (id) => current.access.lessons[id] === "passed",
                ).length
                const chapterStatus = current.access.chapters[chapter.id]
                return (
                  <section className="sidebar-chapter" key={chapter.id}>
                    <div className="sidebar-chapter__head">
                      <span>Глава {String(chapterIndex + 1).padStart(2, "0")}</span>
                      <span>{passedInChapter}/{chapter.lessonIds.length}</span>
                    </div>
                    <h2>{chapter.title}</h2>
                    <div className="sidebar-current-line" aria-hidden />
                    {chapter.lessonIds.map((lessonId) => {
                      const lesson = lessonsById.get(lessonId)
                      if (!lesson) return null
                      const status = current.access.lessons[lessonId] ?? "locked"
                      const isCurrent =
                        location.pathname === `/courses/${courseId}/lessons/${lessonId}` ||
                        location.pathname === `/lessons/${lessonId}`
                      const content = (
                        <>
                          <LessonNode status={status} />
                          <span className="sidebar-lesson__text">
                            <span className="sidebar-lesson__title">{lesson.title}</span>
                            <small>{statusLabel(status)}</small>
                          </span>
                          {status === "locked" ? (
                            <Lock className="sidebar-lock" size={12} aria-hidden />
                          ) : (
                            <ChevronRight className="sidebar-arrow" size={13} aria-hidden />
                          )}
                        </>
                      )
                      return status === "locked" ? (
                        <span
                          className={`sidebar-lesson sidebar-lesson--locked${isCurrent ? " is-current" : ""}`}
                          key={lessonId}
                          aria-disabled="true"
                        >
                          {content}
                        </span>
                      ) : (
                        <NavLink
                          to={`/courses/${courseId}/lessons/${lessonId}`}
                          className={({ isActive }) =>
                            `sidebar-lesson${isActive || isCurrent ? " is-current" : ""}`
                          }
                          key={lessonId}
                        >
                          {content}
                        </NavLink>
                      )
                    })}
                    {chapter.quiz !== null && (() => {
                      const quizAvailable =
                        current.access.nextChapterQuizId === chapter.id || chapterStatus === "passed"
                      const content = (
                        <>
                          <GraduationCap size={14} aria-hidden />
                          <span>Квиз главы</span>
                          <small>{chapterStatus === "passed" ? "сдан" : quizAvailable ? "пройти" : "после уроков"}</small>
                        </>
                      )
                      return quizAvailable ? (
                        <NavLink
                          to={`/courses/${courseId}/chapters/${chapter.id}/quiz`}
                          className={`sidebar-quiz sidebar-quiz--${chapterStatus}`}
                        >
                          {content}
                        </NavLink>
                      ) : (
                        <span className={`sidebar-quiz sidebar-quiz--${chapterStatus} sidebar-quiz--locked`}>
                          {content}
                        </span>
                      )
                    })()}
                  </section>
                )
              })}

              {current.unassigned.length > 0 && (
                <section className="sidebar-new">
                  <div className="sidebar-new__head">
                    <Sparkles size={13} aria-hidden />
                    <span>Новые материалы</span>
                    <b>{current.unassigned.length}</b>
                  </div>
                  <p>Учитель распределит их по главам на занятии.</p>
                  <button
                    type="button"
                    className="sidebar-new__action"
                    onClick={() => {
                      void fetchJson("/api/content/classify", { method: "POST" }).then(() => {
                        void queryClient.invalidateQueries({ queryKey: ["course"] })
                        void queryClient.invalidateQueries({ queryKey: ["courses"] })
                        void queryClient.invalidateQueries({ queryKey: ["project"] })
                      })
                    }}
                  >
                    Распределить сейчас
                  </button>
                </section>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/performance" className="sidebar-footer__link">
            <ChartNoAxesColumn size={15} aria-hidden />
            <span>Успеваемость</span>
            <ChevronRight size={13} aria-hidden />
          </NavLink>
          <NavLink to="/settings" className="sidebar-footer__link">
            <Settings size={15} aria-hidden />
            <span>Настройки</span>
            <ChevronRight size={13} aria-hidden />
          </NavLink>
          <button
            type="button"
            className="sidebar-session sidebar-session--button"
            onClick={() => void endSession()}
            disabled={!sessionActive || sessionEnding}
            title={sessionActive ? "Завершить занятие и получить итог" : "Занятие ещё не начато"}
          >
            {sessionEnding ? (
              <LoaderCircle size={11} className="spin" aria-hidden />
            ) : (
              <Circle size={8} aria-hidden className={sessionActive ? "session-live" : ""} />
            )}
            <span>
              {sessionEnding
                ? "Собираем итог…"
                : sessionActive
                  ? "Занятие идёт · завершить"
                  : "Сессия не начата"}
            </span>
          </button>
          <ThemeToggle />
        </div>
      </aside>
      {open && <button className="sidebar-scrim" type="button" aria-label="Закрыть меню" onClick={onClose} />}
    </>
  )
}
