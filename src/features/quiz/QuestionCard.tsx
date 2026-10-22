import type { LessonDetail } from "../../lib/types"

type Question = LessonDetail["quiz"] extends infer Q
  ? Q extends { questions: Array<infer Item> }
    ? Item
    : never
  : never

export function QuestionCard({
  question,
  index,
  value,
  onChange,
}: {
  question: Question
  index: number
  value: number | string | undefined
  onChange: (value: number | string) => void
}) {
  return (
    <article className="quiz-question">
      <span className="quiz-question__num">{String(index + 1).padStart(2, "0")}</span>
      <div className="quiz-question__body">
        <div className="quiz-question__meta">
          <span>{question.type === "single" ? "тест" : "письменный ответ"}</span>
          <span>·</span>
          <span>{question.type === "single" ? "один вариант" : "своими словами"}</span>
        </div>
        <h3>{question.prompt}</h3>

        {question.type === "single" ? (
          <fieldset className="quiz-options">
            <legend className="visually-hidden">{question.prompt}</legend>
            {question.options?.map((option, optionIndex) => {
              const checked = value === optionIndex
              return (
                <label
                  className={`quiz-option${checked ? " is-checked" : ""}`}
                  key={`${question.id}-${optionIndex}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={optionIndex}
                    checked={checked}
                    onChange={() => onChange(optionIndex)}
                  />
                  <span className="quiz-option__dot" aria-hidden />
                  <span>{option}</span>
                </label>
              )
            })}
          </fieldset>
        ) : (
          <textarea
            className="quiz-textarea"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={question.placeholder || "Напиши ответ своими словами…"}
            rows={5}
            aria-label={question.prompt}
          />
        )}
      </div>
    </article>
  )
}
