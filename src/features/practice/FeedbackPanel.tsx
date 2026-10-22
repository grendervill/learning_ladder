import { Link } from "react-router-dom"
import {
  ArrowRight,
  Check,
  CircleAlert,
  PenLine,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import type { SubmitResponse } from "./SubmitPanel"
import "./FeedbackPanel.css"

export function FeedbackPanel({
  result,
  onRetry,
  kind = "lesson",
}: {
  result: SubmitResponse
  onRetry: () => void
  kind?: "lesson" | "chapter"
}) {
  const feedback = result.feedback
  const next = result.nextLessonId
  const passed = result.passed

  return (
    <section className={`feedback${passed ? " feedback--passed" : " feedback--retry"}`} aria-label="Разбор наставника">
      <header className="feedback__head">
        <div>
          <span className="section-kicker">
            <Sparkles size={13} aria-hidden /> разбор наставника
          </span>
          <h3>
            {passed
              ? kind === "chapter"
                ? "Глава закрыта"
                : "Урок закрыт"
              : "Есть над чем поработать"}
          </h3>
          <p>
            {passed
              ? kind === "chapter"
                ? "Общий квиз сдан. Следующая глава открыта — но сначала посмотри разбор."
                : "Оценка достаточна, следующая папка открыта. Не спеши — прочитай разбор."
              : "Пока не хватает до 4. Разбор ниже поможет доработать без готового решения."}
          </p>
        </div>
        <div className={`feedback-grade${passed ? " is-passed" : ""}`}>
          <strong>{result.grade}</strong>
          <span>из 5</span>
        </div>
      </header>

      <div className="feedback__summary">
        <p>{feedback.summary}</p>
        {feedback.strengths.length > 0 && (
          <div>
            <h4>Сильные стороны</h4>
            <ul>
              {feedback.strengths.map((item) => (
                <li key={item}>
                  <Check size={12} aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {feedback.issues.length > 0 && (
          <div>
            <h4>Что улучшить</h4>
            <ul className="feedback__issues">
              {feedback.issues.map((item) => (
                <li key={item}>
                  <CircleAlert size={12} aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {feedback.nextStep && (
          <div className="feedback__next">
            <PenLine size={13} aria-hidden />
            <span>{feedback.nextStep}</span>
          </div>
        )}
      </div>

      {(feedback.tasks.length > 0 || feedback.quiz.length > 0) && (
        <div className="feedback__details">
          {feedback.tasks.length > 0 && (
            <div>
              <h4>По заданиям</h4>
              {feedback.tasks.map((task) => (
                <div className="feedback-row" key={task.taskId}>
                  <span className={`feedback-dot feedback-dot--${task.status}`} aria-hidden />
                  <div>
                    <b>{task.taskId}</b>
                    <p>{task.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {feedback.quiz.length > 0 && (
            <div>
              <h4>По вопросам</h4>
              {feedback.quiz.map((item) => (
                <div className="feedback-row" key={item.questionId}>
                  <span className={`feedback-dot${item.correct ? " feedback-dot--ok" : " feedback-dot--bad"}`} aria-hidden />
                  <div>
                    <b>{item.questionId}</b>
                    <p>{item.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="feedback__actions">
        {passed ? (
          next ? (
            <Link to={`/lessons/${next}`} className="feedback__primary">
              {kind === "chapter" ? "Первая папка следующей главы" : "Следующий урок"}{" "}
              <ArrowRight size={14} aria-hidden />
            </Link>
          ) : (
            <Link to="/performance" className="feedback__primary">
              Смотреть успеваемость <ArrowRight size={14} aria-hidden />
            </Link>
          )
        ) : (
          <button type="button" className="feedback__primary" onClick={onRetry}>
            <RotateCcw size={13} aria-hidden /> Доработать и сдать снова
          </button>
        )}
        {passed && (
          <span className="feedback__hint">
            Лучшая оценка сохранена. История попыток — в «Успеваемости».
          </span>
        )}
      </footer>
    </section>
  )
}
