import { spawnSync } from "node:child_process"
import { accessSync, constants, existsSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { Router } from "express"
import { Service } from "@opencode/client/service"
import type { AppContext } from "../context"
import {
  providerById,
  readSettings,
  resolveApiKey,
  settingsForClient,
  writeSettings,
} from "../settings"
import { readMentorPrompt, mentorPromptPath, writeMentorPrompt } from "../mentor/prompt"
import { testMentorConnection, deleteMentorSession, type MentorTestInput } from "../mentor/client"

type CheckStatus = "ok" | "warn" | "fail"

interface CheckResult {
  id: string
  group: string
  label: string
  status: CheckStatus
  detail: string
  hint?: string
}

function runCommand(command: string, args: string[]): { ok: boolean; output: string; raw: string; error?: string } {
  try {
    const result = spawnSync(command, args, { encoding: "utf8", timeout: 10_000 })
    const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
    const output = raw.split(/\r?\n/)[0]?.trim() ?? ""
    if (result.error) return { ok: false, output: "", raw: "", error: result.error.message }
    if (result.status !== 0) return { ok: false, output, raw, error: output || `exit ${result.status}` }
    return { ok: true, output, raw }
  } catch (error) {
    return { ok: false, output: "", raw: "", error: error instanceof Error ? error.message : String(error) }
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "")
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function toolCheck(id: string, group: string, label: string, command: string, args: string[], hint?: string): CheckResult {
  const result = runCommand(command, args)
  return {
    id,
    group,
    label,
    status: result.ok ? "ok" : "fail",
    detail: result.ok ? result.output || "доступно" : result.error || "не найдено",
    hint: result.ok ? undefined : hint,
  }
}

export function createSettingsRouter(getContext: () => AppContext): Router {
  const router = Router()

  router.get("/settings", (_req, res) => {
    res.json(settingsForClient())
  })

  router.put("/settings", (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, any>) : {}
    const network = body.network && typeof body.network === "object" ? body.network : undefined
    if (network?.provider && !providerById(network.provider)) {
      res.status(400).json({ error: "unknown_provider" })
      return
    }
    const providers = body.providers && typeof body.providers === "object" ? body.providers : undefined
    writeSettings({ network, providers })
    if (typeof body.mentorPrompt === "string" && body.mentorPrompt.trim()) {
      writeMentorPrompt(body.mentorPrompt)
    }
    // The OpenCode agent reads its model and prompt when a session is created.
    // Drop active mentor sessions so the next call picks up the new settings.
    const context = getContext()
    const activeSessions = context.db
      .prepare(
        "select mentor_session_id as mentorSessionId from study_sessions where status in ('active', 'finalizing') and mentor_session_id is not null",
      )
      .all() as Array<{ mentorSessionId: string }>
    for (const session of activeSessions) {
      void deleteMentorSession(session.mentorSessionId).catch(() => {})
    }
    context.db
      .prepare(
        "update study_sessions set mentor_session_id = null where status in ('active', 'finalizing')",
      )
      .run()
    res.json(settingsForClient())
  })

  router.get("/settings/mentor-prompt", (_req, res) => {
    res.json({ prompt: readMentorPrompt(), path: mentorPromptPath() })
  })

  router.get("/settings/models", (req, res) => {
    const provider = typeof req.query.provider === "string" ? req.query.provider : ""
    const info = providerById(provider)
    if (!info) {
      res.status(400).json({ error: "unknown_provider" })
      return
    }
    if (provider === "opencode") {
      const result = runCommand("opencode", ["models"])
      if (!result.ok) {
        res.json({ provider, models: [], error: result.error })
        return
      }
      const models = result.raw
        .split(/\r?\n/)
        .map((line) => stripAnsi(line).trim())
        .filter((line) => /^[\w.-]+\/[\w.#+-]+$/.test(line))
      res.json({ provider, models })
      return
    }
    res.json({ provider, models: info.models })
  })

  router.post("/settings/test-network", async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === "object" ? (req.body as MentorTestInput) : {}
      const result = await testMentorConnection(body)
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.get("/settings/checks", async (_req, res, next) => {
    try {
      const context = getContext()
      const settings = readSettings()
      const checks: CheckResult[] = []

      checks.push({
        id: "server",
        group: "Система",
        label: "Сервер кабинета",
        status: "ok",
        detail: `Node ${process.version} · ${process.platform} ${process.arch}`,
      })

      const dataDir = join(process.cwd(), "data")
      try {
        mkdirSync(dataDir, { recursive: true })
        accessSync(dataDir, constants.W_OK)
        checks.push({ id: "workspace", group: "Система", label: "Каталог данных", status: "ok", detail: dataDir })
      } catch {
        checks.push({
          id: "workspace",
          group: "Система",
          label: "Каталог данных",
          status: "fail",
          detail: dataDir,
          hint: "Нет прав на запись: прогресс и настройки не сохранятся.",
        })
      }

      checks.push(toolCheck("lua", "Инструменты", "Lua", "lua", ["-v"], "Установите Lua 5.4+ и добавьте его в PATH."))
      checks.push(toolCheck("luac", "Инструменты", "Lua compiler", "luac", ["-v"], "luac нужен для проверки синтаксиса."))
      checks.push(
        toolCheck(
          "lsp",
          "Инструменты",
          "Lua language server",
          "lua-language-server",
          ["--version"],
          "Установите lua-language-server: подсказки в редакторе работать не будут.",
        ),
      )
      checks.push(toolCheck("opencode-cli", "Инструменты", "OpenCode CLI", "opencode", ["--version"], "Установите opencode: наставник через OpenCode не запустится."))

      try {
        const endpoint = await withTimeout(Service.ensure(), 20_000)
        checks.push({
          id: "opencode-service",
          group: "Инструменты",
          label: "Служба OpenCode",
          status: "ok",
          detail: endpoint.url,
        })
      } catch (error) {
        checks.push({
          id: "opencode-service",
          group: "Инструменты",
          label: "Служба OpenCode",
          status: "warn",
          detail: error instanceof Error ? error.message : String(error),
          hint: "Служба поднимется при первом обращении к наставнику. Если ошибка повторяется — проверьте opencode.",
        })
      }

      const dbPath = join(process.cwd(), "data", "learninglua.db")
      try {
        const size = statSync(dbPath).size
        const passed = (context.db.prepare("select count(*) as count from lesson_progress where status = 'passed'").get() as any)?.count ?? 0
        const attempts = (context.db.prepare("select count(*) as count from attempts").get() as any)?.count ?? 0
        checks.push({
          id: "database",
          group: "Данные",
          label: "База прогресса",
          status: "ok",
          detail: `${Math.round(size / 1024)} КБ · пройдено уроков: ${passed} · попыток: ${attempts}`,
        })
      } catch (error) {
        checks.push({
          id: "database",
          group: "Данные",
          label: "База прогресса",
          status: "fail",
          detail: error instanceof Error ? error.message : String(error),
          hint: "Файл data/learninglua.db недоступен.",
        })
      }

      try {
        const course = context.getCourse()
        const lessons = Object.keys(course.lessons).length
        const chapters = course.chapters.length
        const errors = course.errors.length
        checks.push({
          id: "content",
          group: "Данные",
          label: "Материалы курса",
          status: errors ? "warn" : "ok",
          detail: `уроков: ${lessons} · глав: ${chapters}${errors ? ` · ошибок: ${errors}` : ""}${course.unassigned.length ? ` · новых папок: ${course.unassigned.length}` : ""}`,
          hint: errors ? "Часть уроков не удалось разобрать: проверьте папки lessons/ и course/." : undefined,
        })
      } catch (error) {
        checks.push({
          id: "content",
          group: "Данные",
          label: "Материалы курса",
          status: "fail",
          detail: error instanceof Error ? error.message : String(error),
        })
      }

      const promptPath = mentorPromptPath()
      checks.push({
        id: "mentor-prompt",
        group: "Наставник",
        label: "Промпт наставника",
        status: existsSync(promptPath) ? "ok" : "warn",
        detail: existsSync(promptPath) ? `${readMentorPrompt().length} символов · ${promptPath}` : promptPath,
        hint: existsSync(promptPath) ? undefined : "Файл промпта не найден: используется встроенный текст.",
      })

      const provider = providerById(settings.network.provider)
      const key = resolveApiKey(settings.network.provider, settings)
      const needsKey = provider?.needsKey ?? false
      checks.push({
        id: "network",
        group: "Наставник",
        label: "Нейросеть наставника",
        status: needsKey && !key ? "warn" : "ok",
        detail: `${provider?.label ?? settings.network.provider} · ${settings.network.model} · размышления: ${settings.network.reasoning}`,
        hint: needsKey && !key ? "Добавьте API-ключ на вкладке «Нейросеть»." : undefined,
      })

      const summary = {
        ok: checks.filter((check) => check.status === "ok").length,
        warn: checks.filter((check) => check.status === "warn").length,
        fail: checks.filter((check) => check.status === "fail").length,
      }
      res.json({ generatedAt: new Date().toISOString(), summary, checks })
    } catch (error) {
      next(error)
    }
  })

  return router
}
