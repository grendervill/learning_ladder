import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TerminalPanel } from "./TerminalPanel"
import { renderWithProviders } from "../../test/render"

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            cwd: "/workspace",
            stdout: "hello\n",
            stderr: "",
            exitCode: 0,
            durationMs: 2,
            timedOut: false,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({ cwd: "/workspace", history: [] }),
      }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("TerminalPanel", () => {
  it("runs a command and shows output", async () => {
    renderWithProviders(<TerminalPanel lessonId="terminal-basics" taskId="task1" />)

    const input = await screen.findByRole("textbox", { name: "Команда терминала" })
    fireEvent.change(input, { target: { value: "echo hello" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(await screen.findByText("hello")).toBeInTheDocument()
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/terminal"),
        expect.objectContaining({ method: "POST" }),
      ),
    )
  })
})
