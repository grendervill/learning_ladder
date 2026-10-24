import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
} from "lucide-react"
import { fetchJson } from "../../lib/api"
import { useCourses } from "../../lib/useCourses"
import { useProject } from "../../lib/useProject"
import {
  hasNativeFolderPicker,
  pickProjectFolder,
} from "../../lib/projectPicker"
import { plural } from "../../lib/plural"
import { useCourseWizard } from "./CourseWizardProvider"
import { CourseCard } from "./CourseCard"
import "./CoursesHome.css"

export function CoursesHome() {
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const courses = useCourses(query, page)
  const project = useProject()
  const wizard = useCourseWizard()
  const navigate = useNavigate()
  const [changingProject, setChangingProject] = useState(false)

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

  const changeProject = async () => {
    if (!hasNativeFolderPicker()) {
      navigate("/settings?tab=project")
      return
    }
    const selected = await pickProjectFolder()
    if (selected.error) {
      navigate("/settings?tab=project&picker=error")
      return
    }
    if (!selected.path) return
    setChangingProject(true)
    try {
      await fetchJson("/api/project", {
        method: "PUT",
        body: JSON.stringify({ root: selected.path }),
      })
      window.location.reload()
    } catch {
      navigate("/settings?tab=project")
    } finally {
      setChangingProject(false)
    }
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
        <button type="button" className="courses-button courses-button--primary" onClick={wizard.open}>
          <Plus size={16} aria-hidden /> Создать курс
        </button>
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

      {project.data?.fallbackError && (
        <div className="courses-error" role="status">
          <p>{project.data.fallbackError}</p>
          <button
            type="button"
            className="courses-button"
            onClick={() => navigate("/settings?tab=project")}
          >
            Настройки папки
          </button>
        </div>
      )}

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
            <button
              type="button"
              className="courses-button"
              onClick={() => void changeProject()}
              disabled={changingProject}
            >
              {changingProject ? (
                <LoaderCircle size={15} className="spin" aria-hidden />
              ) : (
                <FolderOpen size={15} aria-hidden />
              )}
              Изменить папку проекта
            </button>
            <button type="button" className="courses-button courses-button--primary" onClick={wizard.open}>
              <Plus size={15} aria-hidden /> Создать первый курс
            </button>
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
              <button type="button" className="course-card course-card--create" onClick={wizard.open}>
                <div className="course-card__body">
                  <span className="course-card__icon" aria-hidden>
                    <Plus size={22} strokeWidth={1.7} />
                  </span>
                  <h2>Создать курс</h2>
                  <p>Опиши тему — конструктор соберёт программу и карточку.</p>
                </div>
              </button>
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
