import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConstructorTab } from "./ConstructorTab"
import { renderWithProviders } from "../../test/render"

const prompt = "Ты — методист и конструктор курсов."
const defaultPrompt = "Стандартный промпт конструктора."

function json(value: unknown) {
  return { ok: true, json: async () => value }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/constructor-prompt" && init?.method === "PUT") {
        return json({ prompt: JSON.parse(String(init.body)).prompt })
      }
      if (url === "/api/constructor-prompt") {
        return json({ prompt, path: "/tmp/prompts/constructor.md", defaultPrompt })
      }
      return json({})
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ConstructorTab", () => {
  it("edits and saves the constructor prompt", async () => {
    renderWithProviders(<ConstructorTab />)
    const textarea = await screen.findByLabelText("Промпт конструктора")
    expect(textarea).toHaveValue(prompt)
    fireEvent.change(textarea, { target: { value: "Свой промпт конструктора." } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить промпт" }))
    await waitFor(() => expect(screen.getByText("Сохранено")).toBeInTheDocument())
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const put = calls.find((call) => call[1]?.method === "PUT")
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ prompt: "Свой промпт конструктора." })
  })

  it("can restore the default prompt", async () => {
    renderWithProviders(<ConstructorTab />)
    const textarea = await screen.findByLabelText("Промпт конструктора")
    fireEvent.click(screen.getByRole("button", { name: /Вернуть стандартный/ }))
    expect(textarea).toHaveValue(defaultPrompt)
  })
})
