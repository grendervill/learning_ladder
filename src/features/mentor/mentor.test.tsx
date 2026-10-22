import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MentorDrawer } from "./MentorDrawer"
import { renderWithProviders } from "../../test/render"

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        answer: "Попробуй проверить `type(42)` в REPL и объясни результат.",
        conversationId: "chat-1",
      }),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("MentorDrawer", () => {
  it("asks the mentor and shows a hint", async () => {
    renderWithProviders(
      <MentorDrawer open onClose={() => {}} lessonId="02-variables-types" taskId="task1_types" />,
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Сообщение наставнику" }), {
      target: { value: "Почему type выдаёт string?" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }))

    expect(await screen.findByText(/Попробуй проверить/)).toBeInTheDocument()
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/mentor/ask"),
        expect.objectContaining({ method: "POST" }),
      ),
    )
  })
})
