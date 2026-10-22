import { useEffect, useRef, useState } from "react"
import { Check, CircleAlert, LoaderCircle, Plus, Sigma, Trash2 } from "lucide-react"
import { FormulaField } from "./FormulaField"
import "./StepsPractice.css"

interface Step {
  formula: string
  explanation: string
}

interface Solution {
  steps: Step[]
  answer: string
}

function parseSolution(content: string): Solution {
  try {
    const parsed = JSON.parse(content)
    const steps = Array.isArray(parsed?.steps)
      ? parsed.steps.map((step: any) => ({
          formula: String(step?.formula ?? ""),
          explanation: String(step?.explanation ?? ""),
        }))
      : []
    return {
      steps: steps.length ? steps : [{ formula: "", explanation: "" }],
      answer: String(parsed?.answer ?? ""),
    }
  } catch {
    return { steps: [{ formula: "", explanation: "" }], answer: "" }
  }
}

export function StepsPractice({
  content,
  onChange,
  saveState,
}: {
  content: string
  onChange: (content: string) => void
  saveState: string
}) {
  const [solution, setSolution] = useState<Solution>(() => parseSolution(content))
  const lastEmitted = useRef(content)

  useEffect(() => {
    if (content === lastEmitted.current) return
    lastEmitted.current = content
    setSolution(parseSolution(content))
  }, [content])

  const commit = (next: Solution) => {
    const serialized = JSON.stringify(next, null, 2)
    lastEmitted.current = serialized
    setSolution(next)
    onChange(serialized)
  }

  const updateStep = (index: number, patch: Partial<Step>) => {
    commit({
      ...solution,
      steps: solution.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step,
      ),
    })
  }

  const addStep = () => {
    commit({ ...solution, steps: [...solution.steps, { formula: "", explanation: "" }] })
  }

  const removeStep = (index: number) => {
    const next = solution.steps.filter((_, stepIndex) => stepIndex !== index)
    commit({
      ...solution,
      steps: next.length ? next : [{ formula: "", explanation: "" }],
    })
  }

  return (
    <section className="steps-practice" aria-label="Решение по шагам">
      <header className="steps-head">
        <span className="section-kicker">
          <Sigma size={13} aria-hidden /> решение по шагам
        </span>
        <h3>Покажи, как ты пришёл к ответу</h3>
        <p>
          Формулы вводятся в LaTeX; палитра подскажет интегралы, дроби и степени.
          Наставник проверяет ход решения, а не только финальный ответ.
        </p>
      </header>

      <div className="steps-list">
        {solution.steps.map((step, index) => (
          <article className="step-card" key={index}>
            <div className="step-card__head">
              <span>Шаг {index + 1}</span>
              <button
                type="button"
                className="step-remove"
                onClick={() => removeStep(index)}
                aria-label={`Удалить шаг ${index + 1}`}
              >
                <Trash2 size={13} aria-hidden /> удалить
              </button>
            </div>
            <FormulaField
              value={step.formula}
              onChange={(formula) => updateStep(index, { formula })}
              label={`Формула шага ${index + 1}`}
            />
            <label className="step-explanation">
              <span>Пояснение</span>
              <textarea
                value={step.explanation}
                onChange={(event) => updateStep(index, { explanation: event.target.value })}
                placeholder="Что сделал на этом шаге и почему это законно"
                rows={2}
              />
            </label>
          </article>
        ))}
      </div>

      <div className="steps-actions">
        <button type="button" className="steps-add" onClick={addStep}>
          <Plus size={14} aria-hidden /> Добавить шаг
        </button>
        <div className={`steps-save steps-save--${saveState}`}>
          {saveState === "saving" && <LoaderCircle size={12} className="spin" aria-hidden />}
          {saveState === "saved" && <Check size={12} aria-hidden />}
          {saveState === "error" && <CircleAlert size={12} aria-hidden />}
          <span>
            {saveState === "saving"
              ? "сохраняем"
              : saveState === "saved"
                ? "сохранено"
                : saveState === "error"
                  ? "не сохранено"
                  : "автосохранение"}
          </span>
        </div>
      </div>

      <label className="step-answer">
        <span>Финальный ответ</span>
        <input
          value={solution.answer}
          onChange={(event) => commit({ ...solution, answer: event.target.value })}
          placeholder="Например: 1/3"
        />
      </label>
    </section>
  )
}
