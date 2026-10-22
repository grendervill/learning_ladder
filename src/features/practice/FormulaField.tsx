import { useMemo, useRef } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import "./FormulaField.css"

const SNIPPETS: Array<{ label: string; latex: string; title: string }> = [
  { label: "Дробь", latex: "\\frac{a}{b}", title: "\\frac{числитель}{знаменатель}" },
  { label: "Степень", latex: "^{}", title: "x^{2}" },
  { label: "Индекс", latex: "_{}", title: "x_{i}" },
  { label: "Корень", latex: "\\sqrt{}", title: "\\sqrt{x}" },
  { label: "Интеграл", latex: "\\int_{a}^{b} f(x)\\,dx", title: "Определённый интеграл" },
  { label: "Сумма", latex: "\\sum_{i=1}^{n}", title: "Сумма ряда" },
  { label: "Предел", latex: "\\lim_{x \\to 0}", title: "Предел" },
  { label: "Производная", latex: "\\frac{d}{dx}", title: "Производная" },
  { label: "Частная", latex: "\\frac{\\partial}{\\partial x}", title: "Частная производная" },
  { label: "π", latex: "\\pi", title: "Пи" },
  { label: "α", latex: "\\alpha", title: "Альфа" },
  { label: "≤", latex: "\\le", title: "Меньше или равно" },
  { label: "≥", latex: "\\ge", title: "Больше или равно" },
  { label: "·", latex: "\\cdot", title: "Умножение" },
]

export function FormulaField({
  value,
  onChange,
  label = "Формула",
}: {
  value: string
  onChange: (value: string) => void
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => {
    if (!value.trim()) return { html: "", error: false }
    try {
      return {
        html: katex.renderToString(value, {
          throwOnError: true,
          displayMode: true,
          trust: false,
          strict: "ignore",
        }),
        error: false,
      }
    } catch {
      return { html: "", error: true }
    }
  }, [value])

  const insert = (snippet: string) => {
    const element = input.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? value.length
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + snippet.length, start + snippet.length)
    })
  }

  return (
    <div className="formula-field">
      <label className="formula-field__label">
        {label}
        <input
          ref={input}
          className="formula-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Например: \\int_{0}^{1} x^2\\,dx"
          spellCheck={false}
          aria-label={label}
        />
      </label>
      <div className="formula-palette" aria-label="Палитра формул">
        {SNIPPETS.map((snippet) => (
          <button
            type="button"
            className="formula-snippet"
            key={snippet.label}
            onClick={() => insert(snippet.latex)}
            title={snippet.title}
          >
            {snippet.label}
          </button>
        ))}
      </div>
      <div className={`formula-preview${preview.error ? " formula-preview--error" : ""}`}>
        {preview.error ? (
          <span>Проверьте LaTeX: формула пока не читается.</span>
        ) : preview.html ? (
          <span dangerouslySetInnerHTML={{ __html: preview.html }} />
        ) : (
          <span className="formula-preview__empty">Предпросмотр формулы</span>
        )}
      </div>
    </div>
  )
}
