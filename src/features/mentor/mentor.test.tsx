import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MentorDrawer } from "./MentorDrawer"
import { renderWithProviders } from "../../test/render"

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input)
      if (url === "/api/attachments") {
        return {
          ok: true,
          json: async () => ({
            attachments: [
              {
                id: "attachment-1",
                name: "notes.txt",
                mime: "text/plain",
                size: 12,
                kind: "text",
                createdAt: "2026-10-24T10:00:00.000Z",
              },
            ],
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          answer: "Попробуй проверить `type(42)` в REPL и объясни результат.",
          conversationId: "chat-1",
        }),
      }
    }),
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
    fireEvent.change(screen.getByLabelText("Выбрать файлы"), {
      target: { files: [new File(["Hello notes"], "notes.txt", { type: "text/plain" })] },
    })
    expect(await screen.findByText("notes.txt")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: /Сохранить/ }))
    fireEvent.click(screen.getByRole("button", { name: "Отправить" }))

    expect(await screen.findByText(/Попробуй проверить/)).toBeInTheDocument()
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/mentor/ask"),
        expect.objectContaining({ method: "POST" }),
      ),
    )
    const ask = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((call) =>
      String(call[0]).includes("/mentor/ask"),
    )
    expect(JSON.parse(String(ask?.[1]?.body))).toMatchObject({
      attachmentIds: ["attachment-1"],
      keepAttachments: true,
    })
  })
})
