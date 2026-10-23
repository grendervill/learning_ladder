import { useRef, type PointerEvent } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Atom,
  BookOpen,
  ChartNoAxesColumn,
  Code2,
  Globe2,
  Heart,
  Palette,
  Scale,
  type LucideIcon,
} from "lucide-react"
import type { CourseCard as CourseCardData, CourseIcon } from "../../lib/types"
import { plural } from "../../lib/plural"
import "./CourseCard.css"

const ICONS: Record<CourseIcon, LucideIcon> = {
  book: BookOpen,
  code: Code2,
  chart: ChartNoAxesColumn,
  globe: Globe2,
  atom: Atom,
  scale: Scale,
  palette: Palette,
  heart: Heart,
}

export function CourseCard({ course }: { course: CourseCardData }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const Icon = ICONS[course.icon] ?? BookOpen
  const percent = course.progress.percent
  const started = course.progress.passed > 0
  const label = percent >= 100 ? "Повторить" : started ? "Продолжить" : "Начать"

  const move = (event: PointerEvent<HTMLAnchorElement>) => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    element.style.setProperty("--mx", `${x}px`)
    element.style.setProperty("--my", `${y}px`)
    element.style.setProperty("--rx", `${((y / rect.height) - 0.5) * -4}deg`)
    element.style.setProperty("--ry", `${((x / rect.width) - 0.5) * 4}deg`)
  }

  const leave = () => {
    const element = ref.current
    if (!element) return
    element.style.setProperty("--mx", "50%")
    element.style.setProperty("--my", "50%")
    element.style.setProperty("--rx", "0deg")
    element.style.setProperty("--ry", "0deg")
  }

  return (
    <Link
      ref={ref}
      to={`/courses/${course.id}`}
      className={`course-card course-card--${course.theme}`}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      <div className="course-card__body">
        <div className="course-card__top">
          <span className="course-card__icon" aria-hidden>
            <Icon size={22} strokeWidth={1.7} />
          </span>
          <span className="course-card__mode">{course.mode === "programming" ? "практика · код" : course.mode === "math" ? "практика · шаги" : "практика · разбор"}</span>
        </div>

        <h2>{course.title}</h2>
        <p className="course-card__description">{course.description || "Курс без описания."}</p>

        <div className="course-card__meta">
          <span>{course.progress.chapterCount} {plural(course.progress.chapterCount, ["глава", "главы", "глав"])}</span>
          <span>{course.progress.total} {plural(course.progress.total, ["урок", "урока", "уроков"])}</span>
          <span className="course-card__percent">{percent}%</span>
        </div>

        <div className="course-card__bar" aria-hidden>
          <i style={{ width: `${percent}%` }} />
        </div>

        <span className="course-card__action">
          {label} <ArrowRight size={15} aria-hidden />
        </span>
      </div>
    </Link>
  )
}
