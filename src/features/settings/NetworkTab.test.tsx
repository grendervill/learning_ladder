import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NetworkTab } from "./NetworkTab"
import { renderWithProviders } from "../../test/render"

const settings = {
  network: {
    provider: "opencode",
    model: "opencode-go/deepseek-v4.1-flash",
    reasoning: "off",
    baseUrl: "",
  },
  providers: {
    opencode: { hasKey: false, keyPreview: null, fromEnv: false },
    deepseek: { hasKey: false, keyPreview: null, fromEnv: false },
  },
  catalog: [
    {
      id: "opencode",
      label: "OpenCode (локальный)",
      kind: "opencode",
      needsKey: false,
      defaultModel: "opencode-go/deepseek-v4.1-flash",
      models: [],
      hint: "Модели и варианты подтягиваются из локального OpenCode.",
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      kind: "openai-compatible",
      needsKey: true,
      defaultModel: "deepseek-flash",
      models: [],
      hint: "Модели подтягиваются из API.",
    },
  ],
  settingsPath: "/tmp/settings.json",
}

const catalog = {
  provider: "opencode",
  models: ["opencode-go/deepseek-v4.1-flash", "opencode-go/gpt-6-luna"],
  options: [
    {
      id: "opencode-go/deepseek-v4.1-flash",
      label: "DeepSeek V4.1 Flash · opencode-go/deepseek-v4.1-flash",
      reasoning: [
        { id: "off", label: "Выкл" },
        { id: "low", label: "Низкий" },
        { id: "high", label: "Высокий" },
      ],
    },
    {
      id: "opencode-go/gpt-6-luna",
      label: "GPT-6 Luna · opencode-go/gpt-6-luna",
      reasoning: [
        { id: "off", label: "Выкл" },
        { id: "high", label: "Высокий" },
      ],
    },
  ],
  source: "opencode",
  fetchedAt: "2026-10-23T00:00:00.000Z",
}

function json(value: unknown) {
  return { ok: true, json: async () => value }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/settings/models?provider=opencode") return json(catalog)
      if (url === "/api/settings" && init?.method === "PUT") {
        const body = JSON.parse(String(init.body))
        return json({
          ...settings,
          network: { ...settings.network, ...body.network },
        })
      }
      if (url === "/api/settings") return json(settings)
      return json({})
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("NetworkTab model discovery", () => {
  it("shows API models and only their reasoning variants", async () => {
    renderWithProviders(<NetworkTab />)

    const select = await screen.findByRole("combobox", { name: "Модель" })
    await waitFor(() =>
      expect(select).toHaveValue("opencode-go/deepseek-v4.1-flash"),
    )
    expect(screen.getByRole("radio", { name: "Низкий" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Высокий" })).toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: "Средний" })).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: "opencode-go/gpt-6-luna" } })
    await waitFor(() => expect(select).toHaveValue("opencode-go/gpt-6-luna"))
    expect(screen.queryByRole("radio", { name: "Низкий" })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Высокий" })).toBeInTheDocument()
  })

  it("saves the selected model and reasoning", async () => {
    renderWithProviders(<NetworkTab />)

    const select = await screen.findByRole("combobox", { name: "Модель" })
    await waitFor(() => expect(select).toHaveValue("opencode-go/deepseek-v4.1-flash"))
    fireEvent.change(select, { target: { value: "opencode-go/gpt-6-luna" } })
    await waitFor(() => expect(select).toHaveValue("opencode-go/gpt-6-luna"))
    fireEvent.click(screen.getByRole("radio", { name: "Высокий" }))
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      const put = calls.find(
        (call) => String(call[0]) === "/api/settings" && call[1]?.method === "PUT",
      )
      expect(put).toBeTruthy()
      expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({
        network: {
          provider: "opencode",
          model: "opencode-go/gpt-6-luna",
          reasoning: "high",
        },
      })
    })
  })
})
