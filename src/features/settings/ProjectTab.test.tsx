import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectTab } from "./ProjectTab"
import { renderWithProviders } from "../../test/render"

function json(value: unknown) {
  return { ok: true, json: async () => value }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/project" && init?.method === "PUT") {
        return json({ root: "/tmp/new-project", courses: 0 })
      }
      if (url === "/api/project") {
        return json({ root: "/tmp/current-project", courses: 2, exists: true, writable: true })
      }
      return json({})
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ProjectTab", () => {
  it("shows the current path and switches to a new folder", async () => {
    const onSwitched = vi.fn()
    renderWithProviders(<ProjectTab onSwitched={onSwitched} />)

    expect(await screen.findByText("/tmp/current-project")).toBeInTheDocument()
    expect(screen.getByText("курсов: 2")).toBeInTheDocument()
    const input = screen.getByLabelText("Путь к папке проекта")
    fireEvent.change(input, { target: { value: "/tmp/new-project" } })
    fireEvent.click(screen.getByRole("button", { name: "Сменить папку проекта" }))

    await waitFor(() => expect(onSwitched).toHaveBeenCalled())
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    const put = calls.find((call) => call[1]?.method === "PUT")
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ root: "/tmp/new-project" })
  })
})
