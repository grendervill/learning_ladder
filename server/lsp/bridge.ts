import { spawn, type ChildProcess } from "node:child_process"
import type { WebSocket } from "ws"
import { encodeLspFrame, LspFrameParser } from "./frames"

export interface BridgeOptions {
  command?: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export function createLspBridge(ws: WebSocket, options: BridgeOptions = {}): ChildProcess {
  const command = options.command ?? "lua-language-server"
  const child = spawn(command, options.args ?? [], {
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env, ...options.env },
    stdio: ["pipe", "pipe", "pipe"],
  })
  const parser = new LspFrameParser()
  let closed = false

  const closeWs = (code = 1000, reason = "lsp_closed") => {
    if (ws.readyState === 1) {
      try {
        ws.close(code, reason)
      } catch {
        // Socket already closing.
      }
    }
  }

  ws.on("message", (data) => {
    if (closed) return
    const message = typeof data === "string" ? data : data.toString()
    try {
      child.stdin.write(encodeLspFrame(message))
    } catch {
      closeWs(1011, "lsp_write_failed")
    }
  })

  child.stdin.on("error", () => {
    closeWs(1011, "lsp_stdin_closed")
  })

  child.stdout.on("data", (chunk: Buffer) => {
    for (const message of parser.push(chunk)) {
      if (ws.readyState === 1) {
        try {
          ws.send(message)
        } catch {
          // Socket closed between checks.
        }
      }
    }
  })

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim()
    if (text) console.error(`[lua-language-server] ${text}`)
  })

  child.on("error", (error) => {
    console.error(`[lsp] ${String(error)}`)
    closeWs(1011, "lsp_start_failed")
  })

  child.on("exit", (code, signal) => {
    if (closed) return
    closed = true
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`[lsp] exited code=${code} signal=${signal}`)
    }
    closeWs(1000, "lsp_exited")
  })

  ws.on("close", () => {
    closed = true
    if (!child.killed) {
      child.kill("SIGTERM")
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL")
      }, 1000).unref()
    }
  })

  return child
}
