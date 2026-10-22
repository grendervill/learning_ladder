import { spawn, spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import type { TaskFile } from "../content/types"
import { writeTaskFiles } from "./workspace"

const MAX_OUTPUT_BYTES = 64 * 1024

export interface RunTaskInput {
  lessonId: string
  taskId: string
  files: TaskFile[]
  entry: string
  args?: string[]
  stdin?: string
  timeoutMs?: number
  workspaceRoot?: string
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  timedOut: boolean
  syntaxError: boolean
}

function walkLuaFiles(root: string, dir = root): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkLuaFiles(root, path))
    else if (entry.isFile() && entry.name.endsWith(".lua")) out.push(path)
  }
  return out
}

function checkSyntax(dir: string): { ok: true } | { ok: false; output: string } {
  for (const file of walkLuaFiles(dir)) {
    const result = spawnSync("luac", ["-p", file], { encoding: "utf8" })
    if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: true }
    }
    if (result.status !== 0) {
      return {
        ok: false,
        output: `${result.stderr || result.stdout || "Синтаксическая ошибка"}`.trim(),
      }
    }
  }
  return { ok: true }
}

export async function runLuaTask(input: RunTaskInput): Promise<RunResult> {
  const started = Date.now()
  const dir = writeTaskFiles(
    input.lessonId,
    input.taskId,
    input.files,
    input.workspaceRoot,
  )
  const syntax = checkSyntax(dir)
  if (!syntax.ok) {
    return {
      stdout: "",
      stderr: syntax.output,
      exitCode: 1,
      durationMs: Date.now() - started,
      timedOut: false,
      syntaxError: true,
    }
  }

  const timeoutMs = input.timeoutMs ?? 3000
  return new Promise<RunResult>((resolve) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let settled = false

    const child = spawn("lua", [input.entry, ...(input.args ?? [])], {
      cwd: dir,
      env: {
        ...process.env,
        LUA_PATH: "./?.lua;./?/init.lua;;",
      },
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    })

    const append = (current: string, chunk: Buffer): string => {
      if (Buffer.byteLength(current, "utf8") >= MAX_OUTPUT_BYTES) return current
      const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(current, "utf8")
      return current + chunk.subarray(0, remaining).toString("utf8")
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })

    const finish = (code: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        stdout,
        stderr,
        exitCode: timedOut ? 124 : code,
        durationMs: Date.now() - started,
        timedOut,
        syntaxError: false,
      })
    }

    const killTree = () => {
      if (!child.pid) return
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {
        child.kill("SIGKILL")
      }
    }

    const timer = setTimeout(() => {
      timedOut = true
      killTree()
    }, timeoutMs)

    child.on("error", (error) => {
      stderr = `${stderr}\n${String(error)}`
      finish(1)
    })
    child.on("close", (code) => finish(code ?? 1))

    child.stdin.end(input.stdin ?? "")
  })
}
