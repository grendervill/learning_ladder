import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, BookOpen, CircleCheck, Compass, Settings2, Sparkles } from "lucide-react"
import { useCourse } from "../../lib/useCourse"
import { AccessError, PageSkeleton } from "./CourseStates"
import "./CourseHome.css"
import "./CoursePage.css"

export function CoursePage() {
  const { courseId } = useParams()
  const { data: course, isLoading, isError, refetch } = useCourse(courseId)

  if (isLoading) return <PageSkeleton label="Открываем курс" />
  if (isError || !course) return <AccessError onRetry={() => refetch()} />

  const lessons = new Map(course.lessons.map((lesson) => [lesson.id, lesson]))
  const nextLesson = course.access.nextLessonId ? lessons.get(course.access.nextLessonId) : null
  const passed = course.progress?.passed ?? Object.values(course.access.lessons).filter((status) => status === "passed").length
  const total = course.progress?.total ?? course.lessons.length
  const percent = course.progress?.percent ?? (total ? Math.round((passed / total) * 100) : 0)

  return (
    <div className="home">
      <div className="home-course-nav">
        <Link to="/">
          <ArrowLeft size={14} aria-hidden /> Все курсы
        </Link>
        <Link to={`/courses/${courseId}/settings`} className="course-settings-link">
          <Settings2 size={14} aria-hidden /> Настройки курса
        </Link>
      </div>

      <header className="home-head">
        <p className="home-kicker">курс</p>
        <h1>{course.course?.title ?? "Курс"}</h1>
        <p className="home-deck">
          {course.course?.description || "Материалы курса, вопросы и практика в одном маршруте."}
        </p>
      </header>

      {nextLesson ? (
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
            <Link to={`/courses/${courseId}/lessons/${nextLesson.id}`} className="home-cta">
              Продолжить <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="home-orbit" aria-label={`Пройдено ${percent}%`}>
            <div className="home-orbit__ring home-orbit__ring--one" />
            <div className="home-orbit__ring home-orbit__ring--two" />
            <div className="home-orbit__moon">
              <span>{percent}%</span>
            </div>
            <i className="home-orbit__dot home-orbit__dot--one" />
            <i className="home-orbit__dot home-orbit__dot--two" />
          </div>
        </section>
      ) : (
        <section className="home-continue home-continue--complete">
          <div className="home-continue__copy">
            <span className="home-label">
              <CircleCheck size={13} aria-hidden /> курс пройден
            </span>
            <h2>Все уроки закрыты</h2>
            <p>Можно вернуться к любому уроку или начать новый курс.</p>
            <Link to="/" className="home-cta">
              К курсам <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="home-orbit" aria-label={`Пройдено ${percent}%`}>
            <div className="home-orbit__ring home-orbit__ring--one" />
            <div className="home-orbit__moon">
              <span>{percent}%</span>
            </div>
          </div>
        </section>
      )}

      <section className="home-map">
        <div className="home-map__head">
          <div>
            <span className="home-label">
              <Compass size={13} aria-hidden /> программа
            </span>
            <h2>Лестница курса</h2>
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
