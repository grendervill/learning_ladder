import { ArrowLeft, BookOpen } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { useCourse } from "../../lib/useCourse"
import { PageSkeleton } from "../course/CourseStates"
import "./LessonPlaceholder.css"

export function LessonPlaceholder() {
  const { lessonId } = useParams()
  const { data: course, isLoading } = useCourse()
  if (isLoading) return <PageSkeleton label="Открываем урок" />
  const lesson = course?.lessons.find((item) => item.id === lessonId)

  return (
    <div className="lesson-placeholder">
      <Link to="/" className="lesson-back">
        <ArrowLeft size={14} aria-hidden /> К программе
      </Link>
      <div className="lesson-placeholder__mark">
        <BookOpen size={20} aria-hidden />
      </div>
      <p className="lesson-placeholder__kicker">Урок</p>
      <h1>{lesson?.title ?? "Материал"}</h1>
      <p>Теория, вопросы и практика подключаются следующим шагом.</p>
    </div>
  )
}
