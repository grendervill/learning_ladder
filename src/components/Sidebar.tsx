import { NavLink, useLocation } from "react-router-dom"
import {
  ChartNoAxesColumn,
  Check,
  ChevronRight,
  Circle,
  GraduationCap,
  Lock,
  Sparkles,
} from "lucide-react"
import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { fetchJson } from "../lib/api"
import { useCourse } from "../lib/useCourse"
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
  const { data: course, isLoading, isError } = useCourse()
  const { active: sessionActive, endSession } = useSession()
  const queryClient = useQueryClient()
  const location = useLocation()

  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const lessonsById = new Map((course?.lessons ?? []).map((lesson) => [lesson.id, lesson]))
  const totalLessons = course?.lessons.length ?? 0
  const passedLessons = course
    ? Object.values(course.access.lessons).filter((status) => status === "passed").length
    : 0
  const progress = totalLessons ? Math.round((passedLessons / totalLessons) * 100) : 0

  return (
    <>
      <aside className={`sidebar${open ? " sidebar--open" : ""}`} aria-label="Программа курса">
        <div className="sidebar-brand">
          <div className="moon-mark" aria-hidden>
            <span />
          </div>
          <div>
            <strong>Лестница Lua</strong>
            <small>от нуля до эксперта</small>
          </div>
        </div>

        <div className="sidebar-progress">
          <div className="sidebar-progress__top">
            <span>Прогресс курса</span>
            <b>{progress}%</b>
          </div>
          <div className="sidebar-progress__bar" aria-hidden>
            <i style={{ width: `${progress}%` }} />
          </div>
          <small>
            {passedLessons} из {totalLessons} уроков · {course?.chapters.length ?? 0} глав
          </small>
        </div>

        <nav className="sidebar-nav">
          {isLoading && (
            <div className="sidebar-skeleton" aria-label="Загрузка программы">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          {isError && <p className="sidebar-error">Не удалось загрузить программу.</p>}
          {course?.chapters.map((chapter, chapterIndex) => {
            const passedInChapter = chapter.lessonIds.filter(
              (id) => course.access.lessons[id] === "passed",
            ).length
            const chapterStatus = course.access.chapters[chapter.id]
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
                  const status = course.access.lessons[lessonId] ?? "locked"
                  const isCurrent = location.pathname === `/lessons/${lessonId}`
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
                      to={`/lessons/${lessonId}`}
                      className={({ isActive }) =>
                        `sidebar-lesson${isActive ? " is-current" : ""}`
                      }
                      key={lessonId}
                    >
                      {content}
                    </NavLink>
                  )
                })}
                {chapter.quiz !== null && (() => {
                  const quizAvailable =
                    course.access.nextChapterQuizId === chapter.id || chapterStatus === "passed"
                  const content = (
                    <>
                      <GraduationCap size={14} aria-hidden />
                      <span>Квиз главы</span>
                      <small>{chapterStatus === "passed" ? "сдан" : quizAvailable ? "пройти" : "после уроков"}</small>
                    </>
                  )
                  return quizAvailable ? (
                    <NavLink
                      to={`/chapters/${chapter.id}/quiz`}
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

          {course && course.unassigned.length > 0 && (
            <section className="sidebar-new">
              <div className="sidebar-new__head">
                <Sparkles size={13} aria-hidden />
                <span>Новые материалы</span>
                <b>{course.unassigned.length}</b>
              </div>
              <p>Учитель распределит их по главам на занятии.</p>
              <button
                type="button"
                className="sidebar-new__action"
                onClick={() => {
                  void fetchJson("/api/content/classify", { method: "POST" }).then(() =>
                    queryClient.invalidateQueries({ queryKey: ["course"] }),
                  )
                }}
              >
                Распределить сейчас
              </button>
            </section>
          )}
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/performance" className="sidebar-footer__link">
            <ChartNoAxesColumn size={15} aria-hidden />
            <span>Успеваемость</span>
            <ChevronRight size={13} aria-hidden />
          </NavLink>
          <button
            type="button"
            className="sidebar-session sidebar-session--button"
            onClick={() => void endSession()}
            disabled={!sessionActive}
            title={sessionActive ? "Завершить занятие и получить итог" : "Занятие ещё не начато"}
          >
            <Circle size={8} aria-hidden className={sessionActive ? "session-live" : ""} />
            <span>{sessionActive ? "Занятие идёт · завершить" : "Сессия не начата"}</span>
          </button>
          <ThemeToggle />
        </div>
      </aside>
      {open && <button className="sidebar-scrim" type="button" aria-label="Закрыть меню" onClick={onClose} />}
    </>
  )
}
