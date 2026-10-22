import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Sparkles,
} from "lucide-react"
import { useCourses } from "../../lib/useCourses"
import { useProject } from "../../lib/useProject"
import { CourseCard } from "./CourseCard"
import "./CoursesHome.css"

function plural(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export function CoursesHome() {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const courses = useCourses(query, page)
  const project = useProject()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [input])

  const data = courses.data
  const total = data?.total ?? 0
  const pages = data?.pages ?? 0
  const currentPage = data?.page ?? page
  const emptyProject = !courses.isLoading && !query && total === 0
  const emptySearch = !courses.isLoading && Boolean(query) && total === 0

  const countLabel = useMemo(
    () => `${total} ${plural(total, ["курс", "курса", "курсов"])}`,
    [total],
  )

  const goToPage = (next: number) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="courses-home">
      <header className="courses-head">
        <div>
          <span className="section-kicker">
            <Sparkles size={13} aria-hidden /> кабинет
          </span>
          <h1>Твои курсы</h1>
          <p>
            Выбери маршрут или собери новый — под тему, темп и свой способ разбираться.
          </p>
        </div>
        <Link to="/settings?tab=create" className="courses-button courses-button--primary">
          <Plus size={16} aria-hidden /> Создать курс
        </Link>
      </header>

      <div className="courses-toolbar">
        <label className="courses-search">
          <Search size={15} aria-hidden />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Найти курс по названию или теме"
            aria-label="Поиск по курсам"
          />
        </label>
        {!courses.isLoading && <span className="courses-count">{countLabel}</span>}
      </div>

      {courses.isError && (
        <div className="courses-error">
          <p>Не удалось загрузить курсы.</p>
          <button type="button" className="courses-button" onClick={() => void courses.refetch()}>
            Повторить
          </button>
        </div>
      )}

      {courses.isLoading && (
        <div className="courses-grid" aria-busy="true" aria-label="Загружаем курсы">
          <div className="courses-skeleton" />
          <div className="courses-skeleton" />
          <div className="courses-skeleton" />
          <div className="courses-skeleton" />
        </div>
      )}

      {!courses.isLoading && !courses.isError && emptyProject && (
        <section className="courses-empty">
          <span className="courses-empty__icon">
            <AlertTriangle size={20} aria-hidden />
          </span>
          <div className="courses-empty__copy">
            <h2>Пока ни одного курса</h2>
            <p>
              Курсы создаются каждый в своей папке внутри папки проекта. Сейчас программа
              работает с папкой:
            </p>
            <code>{project.data?.root ?? "путь определяется…"}</code>
          </div>
          <div className="courses-empty__actions">
            <Link to="/settings?tab=project" className="courses-button">
              Изменить папку проекта
            </Link>
            <Link to="/settings?tab=create" className="courses-button courses-button--primary">
              <Plus size={15} aria-hidden /> Создать первый курс
            </Link>
          </div>
        </section>
      )}

      {emptySearch && (
        <div className="courses-not-found">
          <Search size={18} aria-hidden />
          <p>По запросу «{query}» ничего не нашлось.</p>
          <button
            type="button"
            className="courses-button"
            onClick={() => {
              setInput("")
              setQuery("")
              setPage(1)
            }}
          >
            Сбросить поиск
          </button>
        </div>
      )}

      {!courses.isLoading && !courses.isError && total > 0 && (
        <>
          <div className="courses-grid">
            {data?.courses.map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
            {!query && (
              <Link to="/settings?tab=create" className="course-card course-card--create">
                <div className="course-card__body">
                  <span className="course-card__icon" aria-hidden>
                    <Plus size={22} strokeWidth={1.7} />
                  </span>
                  <h2>Создать курс</h2>
                  <p>Опиши тему — конструктор соберёт программу и карточку.</p>
                </div>
              </Link>
            )}
          </div>

          {pages > 1 && (
            <nav className="courses-pagination" aria-label="Страницы курсов">
              <button
                type="button"
                className="courses-page-button"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ChevronLeft size={15} aria-hidden /> Назад
              </button>
              <span>
                Страница {currentPage} из {pages}
              </span>
              <button
                type="button"
                className="courses-page-button"
                disabled={currentPage >= pages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Вперёд <ChevronRight size={15} aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
