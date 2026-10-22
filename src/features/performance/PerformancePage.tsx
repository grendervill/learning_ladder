import { useMemo } from "react"
import { ChartNoAxesColumn, CircleCheck, GraduationCap, Sparkles } from "lucide-react"
import { useCourse } from "../../lib/useCourse"
import { useProgress } from "../../lib/useProgress"
import { plural } from "../../lib/plural"
import { AccessError, PageSkeleton } from "../course/CourseStates"
import { GradeTable } from "./GradeTable"
import { ReportList } from "./ReportList"
import "./PerformancePage.css"

export function PerformancePage() {
  const course = useCourse()
  const progress = useProgress()

  const summary = useMemo(() => {
    if (!progress.data) return { passed: 0, total: 0, percent: 0 }
    const total = Object.keys(progress.data.access.lessons).length
    const passed = Object.values(progress.data.access.lessons).filter((status) => status === "passed").length
    return { passed, total, percent: total ? Math.round((passed / total) * 100) : 0 }
  }, [progress.data])

  if (course.isLoading || progress.isLoading) return <PageSkeleton label="Собираем успеваемость" />
  if (course.isError || progress.isError || !course.data || !progress.data) {
    return <AccessError onRetry={() => { void course.refetch(); void progress.refetch() }} />
  }

  const grades = Object.values(progress.data.lessons).filter((lesson) => lesson.bestGrade !== null)
  const average = grades.length
    ? (grades.reduce((sum, lesson) => sum + (lesson.bestGrade ?? 0), 0) / grades.length).toFixed(1)
    : "—"

  return (
    <div className="performance-page">
      <header className="performance-head">
        <div>
          <span className="section-kicker">
            <ChartNoAxesColumn size={13} aria-hidden /> успеваемость
          </span>
          <h1>Твой маршрут целиком</h1>
          <p>Оценки, попытки и итоги занятий. Всё хранится локально.</p>
        </div>
        <div className="performance-orbit" aria-label={`Пройдено ${summary.percent}%`}>
          <div className="performance-orbit__ring" />
          <div className="performance-orbit__moon">
            <strong>{summary.percent}%</strong>
            <small>{summary.passed} / {summary.total}</small>
          </div>
        </div>
      </header>

      <section className="performance-stats">
        <div>
          <span>Средний балл</span>
          <strong>{average}</strong>
        </div>
        <div>
          <span>Попыток сдачи</span>
          <strong>{progress.data.attempts.length}</strong>
        </div>
        <div>
          <span>Итогов занятий</span>
          <strong>{progress.data.sessions.filter((session) => session.summaryMd).length}</strong>
        </div>
        <div>
          <span>Глав закрыто</span>
          <strong>{Object.values(progress.data.chapters).filter((chapter) => chapter.status === "passed").length}</strong>
        </div>
      </section>

      <section className="performance-section">
        <div className="performance-section__head">
          <div>
            <span className="section-kicker">
              <GraduationCap size={13} aria-hidden /> оценки
            </span>
            <h2>По главам и урокам</h2>
          </div>
          <span>{summary.passed} из {summary.total} {plural(summary.total, ["урока", "уроков", "уроков"])} закрыто</span>
        </div>
        <GradeTable course={course.data} progress={progress.data} />
      </section>

      <section className="performance-section">
        <div className="performance-section__head">
          <div>
            <span className="section-kicker">
              <Sparkles size={13} aria-hidden /> история
            </span>
            <h2>Попытки сдачи</h2>
          </div>
          <span>последние {progress.data.attempts.length}</span>
        </div>
        {progress.data.attempts.length === 0 ? (
          <p className="performance-empty">Попыток пока нет. Первая сдача появится здесь.</p>
        ) : (
          <div className="attempt-list">
            {progress.data.attempts.map((attempt) => (
              <details className="attempt-item" key={attempt.id}>
                <summary>
                  <span className="attempt-grade">{attempt.grade}</span>
                  <div className="attempt-summary">
                    <b>{attempt.scopeId}</b>
                    <p>{attempt.feedback?.summary ?? "Разбор сохранён."}</p>
                  </div>
                  <time>{new Date(attempt.submittedAt).toLocaleString("ru-RU")}</time>
                </summary>
                <div className="attempt-detail">
                  {attempt.feedback?.strengths?.length > 0 && (
                    <div>
                      <h4>Сильные стороны</h4>
                      <ul>
                        {attempt.feedback.strengths.map((item: string) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {attempt.feedback?.issues?.length > 0 && (
                    <div>
                      <h4>Что улучшить</h4>
                      <ul>
                        {attempt.feedback.issues.map((item: string) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {attempt.feedback?.tasks?.length > 0 && (
                    <div>
                      <h4>По заданиям</h4>
                      {attempt.feedback.tasks.map((task: any) => (
                        <p key={task.taskId}>
                          <b>{task.taskId}</b> — {task.comment}
                        </p>
                      ))}
                    </div>
                  )}
                  {attempt.feedback?.quiz?.length > 0 && (
                    <div>
                      <h4>По вопросам</h4>
                      {attempt.feedback.quiz.map((question: any) => (
                        <p key={question.questionId}>
                          <b>{question.questionId}</b> — {question.comment}
                        </p>
                      ))}
                    </div>
                  )}
                  {attempt.feedback?.nextStep && (
                    <div className="attempt-detail__next">
                      <b>Следующий шаг:</b> {attempt.feedback.nextStep}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="performance-section">
        <div className="performance-section__head">
          <div>
            <span className="section-kicker">
              <CircleCheck size={13} aria-hidden /> отчёты
            </span>
            <h2>Итоги занятий</h2>
          </div>
        </div>
        <ReportList sessions={progress.data.sessions} />
      </section>
    </div>
  )
}
