import { spawn } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { resolve, sep } from "node:path"
import { workspacePath, DEFAULT_WORKSPACE_ROOT } from "../lua/workspace"

const MAX_OUTPUT_BYTES = 64 * 1024
const cwdState = new Map<string, string>()

export interface TerminalCommandInput {
  lessonId: string
  taskId: string
  command: string
  cwd?: string
  timeoutMs?: number
  workspaceRoot?: string
}

export interface TerminalCommandResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  timedOut: boolean
  cwd: string
}

function appendCapped(current: string, chunk: Buffer): string {
  if (Buffer.byteLength(current, "utf8") >= MAX_OUTPUT_BYTES) return current
  const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(current, "utf8")
  return current + chunk.subarray(0, remaining).toString("utf8")
}

function within(root: string, target: string): boolean {
  return target === root || target.startsWith(root + sep)
}

function resolveCwd(
  lessonId: string,
  taskId: string,
  cwd: string | undefined,
  root: string,
): string {
  const base = workspacePath(lessonId, taskId, root)
  const candidate = cwd ?? cwdState.get(`${lessonId}/${taskId}`) ?? base
  if (!within(base, candidate) || !existsSync(candidate) || !statSync(candidate).isDirectory()) {
    return base
  }
  return candidate
}

export async function runTerminalCommand(
  input: TerminalCommandInput,
): Promise<TerminalCommandResult> {
  const started = Date.now()
  const root = input.workspaceRoot ?? DEFAULT_WORKSPACE_ROOT
  const cwd = resolveCwd(input.lessonId, input.taskId, input.cwd, root)
  const workspace = workspacePath(input.lessonId, input.taskId, root)
  const command = input.command.trim()

  if (!command) {
    return { stdout: "", stderr: "", exitCode: 0, durationMs: 0, timedOut: false, cwd }
  }

  const cdMatch = command.match(/^cd(?:\s+(.+))?$/)
  if (cdMatch && !/[|&;<>]/.test(cdMatch[1] ?? "")) {
    const raw = (cdMatch[1] ?? ".").trim().replace(/^(['"])(.*)\1$/, "$2")
    const target = resolve(cwd, raw)
    if (!within(workspace, target)) {
      return {
        stdout: "",
        stderr: "cd: нельзя выйти за пределы задания",
        exitCode: 1,
        durationMs: Date.now() - started,
        timedOut: false,
        cwd,
      }
    }
    if (!existsSync(target) || !statSync(target).isDirectory()) {
      return {
        stdout: "",
        stderr: `cd: нет такого каталога: ${raw}`,
        exitCode: 1,
        durationMs: Date.now() - started,
        timedOut: false,
        cwd,
      }
    }
    cwdState.set(`${input.lessonId}/${input.taskId}`, target)
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
      durationMs: Date.now() - started,
      timedOut: false,
      cwd: target,
    }
  }

  return new Promise<TerminalCommandResult>((resolvePromise) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let settled = false

    const child = spawn("sh", ["-c", command], {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    })

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendCapped(stdout, chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendCapped(stderr, chunk)
    })

    const finish = (code: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cwdState.set(`${input.lessonId}/${input.taskId}`, cwd)
      resolvePromise({
        stdout,
        stderr,
        exitCode: timedOut ? 124 : code,
        durationMs: Date.now() - started,
        timedOut,
        cwd,
      })
    }

    const timer = setTimeout(() => {
      timedOut = true
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL")
        } catch {
          child.kill("SIGKILL")
        }
      }
    }, input.timeoutMs ?? 3000)

    child.on("error", (error) => {
      stderr = `${stderr}\n${String(error)}`
      finish(1)
    })
    child.on("close", (code) => finish(code ?? 1))
  })
}
