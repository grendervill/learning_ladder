import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve, sep } from "node:path"
import type { TaskFile } from "../content/types"

const MAX_OUTPUT_BYTES = 64 * 1024

export interface RunTaskInput {
  files: TaskFile[]
  entry: string
  command: string
  args?: string[]
  stdin?: string
  timeoutMs?: number
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export interface RunTaskResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  timedOut: boolean
  syntaxError: boolean
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function safeTarget(dir: string, name: string): string {
  if (!name || name.startsWith("/") || name.includes("\\") || name.includes("\0")) {
    throw new Error(`unsafe_file_name:${name}`)
  }
  const target = resolve(dir, name)
  if (target !== dir && !target.startsWith(dir + sep)) {
    throw new Error(`unsafe_file_name:${name}`)
  }
  return target
}

function writeFiles(dir: string, files: TaskFile[]): void {
  for (const file of files) {
    const target = safeTarget(dir, file.name)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content, "utf8")
  }
}

export async function runTask(input: RunTaskInput): Promise<RunTaskResult> {
  const command = input.command.trim()
  if (!command) throw new Error("run_command_missing")

  const entry = input.entry || input.files[0]?.name || ""
  if (!entry) throw new Error("entry_missing")

  const temporary = !input.cwd
  const dir = input.cwd ?? mkdtempSync(join(tmpdir(), "ladder-run-"))
  mkdirSync(dir, { recursive: true })
  writeFiles(dir, input.files)

  const binary = join(dir, ".ladder-bin")
  const args = input.args ?? []
  const rendered = command
    .replaceAll("{file}", shellQuote(entry))
    .replaceAll("{bin}", shellQuote(binary))
    .replaceAll("{dir}", shellQuote(dir))
  const fullCommand = `${rendered}${args.length ? ` ${args.map(shellQuote).join(" ")}` : ""}`
  const started = Date.now()

  return new Promise<RunTaskResult>((resolvePromise) => {
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let settled = false
    let timer: NodeJS.Timeout | undefined

    const append = (current: string, chunk: Buffer): string => {
      if (Buffer.byteLength(current, "utf8") >= MAX_OUTPUT_BYTES) return current
      const remaining = MAX_OUTPUT_BYTES - Buffer.byteLength(current, "utf8")
      return current + chunk.subarray(0, remaining).toString("utf8")
    }

    const cleanup = () => {
      if (!temporary) return
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Best-effort cleanup of a temporary workspace.
      }
    }

    const child = spawn("bash", ["-lc", fullCommand], {
      cwd: dir,
      env: { ...process.env, ...input.env },
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    })

    const finish = (code: number) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      cleanup()
      resolvePromise({
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

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })

    child.on("error", (error) => {
      stderr = `${stderr}\n${String(error)}`
      finish(1)
    })
    child.on("close", (code) => finish(code ?? 1))

    timer = setTimeout(() => {
      timedOut = true
      killTree()
    }, Math.max(500, Math.min(10_000, input.timeoutMs ?? 3000)))

    // A fast program may exit before stdin is written; EPIPE is not a runner failure.
    child.stdin.on("error", () => {})
    try {
      child.stdin.end(input.stdin ?? "")
    } catch {
      // The process already closed; stdout/stderr are still reported.
    }
  })
}
