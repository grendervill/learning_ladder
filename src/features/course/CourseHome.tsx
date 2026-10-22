import { ArrowRight, BookOpen, CircleCheck, Compass, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"
import { useCourse } from "../../lib/useCourse"
import { AccessError, PageSkeleton } from "./CourseStates"
import "./CourseHome.css"

export function CourseHome() {
  const { data: course, isLoading, isError, refetch } = useCourse()

  if (isLoading) return <PageSkeleton label="Открываем программу" />
  if (isError || !course) return <AccessError onRetry={() => refetch()} />

  const lessons = new Map(course.lessons.map((lesson) => [lesson.id, lesson]))
  const nextLesson = course.access.nextLessonId ? lessons.get(course.access.nextLessonId) : null
  const passed = Object.values(course.access.lessons).filter((status) => status === "passed").length
  const total = course.lessons.length

  return (
    <div className="home">
      <header className="home-head">
        <p className="home-kicker">Твой учебный кабинет</p>
        <h1>
          Один шаг за раз.
          <br />
          <em>Сегодня — Lua.</em>
        </h1>
        <p className="home-deck">
          Теория, вопросы и практика в одном месте. Наставник рядом, но код пишешь ты.
        </p>
      </header>

      {nextLesson && (
        <section className="home-continue">
          <div className="home-continue__copy">
            <span className="home-label">
              <Sparkles size={13} aria-hidden /> следующая остановка
            </span>
            <h2>{nextLesson.title}</h2>
            <p>
              {course.access.lessons[nextLesson.id] === "in_progress"
                ? "Ты уже начал этот урок. Продолжим с места, где остановился."
                : "Первый доступный урок. Можно начинать."}
            </p>
            <Link to={`/lessons/${nextLesson.id}`} className="home-cta">
              Продолжить <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="home-orbit" aria-hidden>
            <div className="home-orbit__ring home-orbit__ring--one" />
            <div className="home-orbit__ring home-orbit__ring--two" />
            <div className="home-orbit__moon">
              <span>{Math.round((passed / Math.max(total, 1)) * 100)}%</span>
            </div>
            <i className="home-orbit__dot home-orbit__dot--one" />
            <i className="home-orbit__dot home-orbit__dot--two" />
          </div>
        </section>
      )}

      <section className="home-map">
        <div className="home-map__head">
          <div>
            <span className="home-label">
              <Compass size={13} aria-hidden /> программа
            </span>
            <h2>Лестница целиком</h2>
          </div>
          <span className="home-map__count">{passed} / {total} закрыто</span>
        </div>
        <div className="home-map__list">
          {course.chapters.map((chapter, index) => {
            const passedInChapter = chapter.lessonIds.filter(
              (id) => course.access.lessons[id] === "passed",
            ).length
            const status = course.access.chapters[chapter.id]
            return (
              <div className="home-chapter" key={chapter.id}>
                <span className="home-chapter__num">{String(index + 1).padStart(2, "0")}</span>
                <div className="home-chapter__body">
                  <h3>{chapter.title}</h3>
                  <p>{chapter.description}</p>
                </div>
                <span className={`home-chapter__status home-chapter__status--${status}`}>
                  {status === "passed" ? (
                    <CircleCheck size={14} aria-hidden />
                  ) : (
                    <BookOpen size={14} aria-hidden />
                  )}
                  {passedInChapter}/{chapter.lessonIds.length}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
