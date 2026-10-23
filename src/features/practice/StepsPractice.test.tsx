import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StepsPractice } from "./StepsPractice"
import { renderWithProviders } from "../../test/render"

const starter = JSON.stringify({
  steps: [],
  answer: "",
})

afterEach(() => {
  cleanup()
})

describe("StepsPractice", () => {
  it("edits steps, renders KaTeX and saves the solution JSON", () => {
    const onChange = vi.fn()
    const { container } = renderWithProviders(
      <StepsPractice content={starter} onChange={onChange} saveState="saved" />,
    )

    expect(screen.getByText("Шаг 1")).toBeInTheDocument()
    expect(screen.getByText("сохранено")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Формула шага 1"), {
      target: { value: "\\frac{1}{2}" },
    })
    expect(container.querySelector(".katex")).not.toBeNull()

    fireEvent.change(screen.getByLabelText("Пояснение"), {
      target: { value: "Делим пополам." },
    })
    fireEvent.change(screen.getByLabelText("Финальный ответ"), {
      target: { value: "1/2" },
    })

    let saved = JSON.parse(String(onChange.mock.calls.at(-1)?.[0]))
    expect(saved.answer).toBe("1/2")
    expect(saved.steps[0]).toEqual({ formula: "\\frac{1}{2}", explanation: "Делим пополам." })

    fireEvent.click(screen.getByRole("button", { name: /Добавить шаг/ }))
    expect(screen.getByText("Шаг 2")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Формула шага 2"), {
      target: { value: "\\int_0^1 x\\,dx" },
    })
    saved = JSON.parse(String(onChange.mock.calls.at(-1)?.[0]))
    expect(saved.steps).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Удалить шаг 2" }))
    expect(screen.queryByText("Шаг 2")).not.toBeInTheDocument()
    saved = JSON.parse(String(onChange.mock.calls.at(-1)?.[0]))
    expect(saved.steps).toHaveLength(1)
  })

  it("inserts palette snippets into the focused formula field", () => {
    const onChange = vi.fn()
    renderWithProviders(<StepsPractice content={starter} onChange={onChange} saveState="idle" />)

    fireEvent.click(screen.getByRole("button", { name: "Дробь" }))
    expect(screen.getByLabelText("Формула шага 1")).toHaveValue("\\frac{a}{b}")
  })

  it("syncs when the saved solution arrives after the first render", () => {
    const onChange = vi.fn()
    const saved = JSON.stringify(
      {
        steps: [
          { formula: "\\int_0^1 x^2\\,dx", explanation: "Площадь под параболой." },
          { formula: "\\frac{1}{3}", explanation: "Считаем." },
        ],
        answer: "1/3",
      },
      null,
      2,
    )
    const view = renderWithProviders(
      <StepsPractice content={starter} onChange={onChange} saveState="idle" />,
    )
    expect(screen.getByLabelText("Формула шага 1")).toHaveValue("")
    view.rerender(<StepsPractice content={saved} onChange={onChange} saveState="saved" />)
    expect(screen.getByText("Шаг 2")).toBeInTheDocument()
    expect(screen.getByLabelText("Формула шага 1")).toHaveValue("\\int_0^1 x^2\\,dx")
    expect(screen.getByLabelText("Финальный ответ")).toHaveValue("1/3")
    expect(onChange).not.toHaveBeenCalled()
  })
})
