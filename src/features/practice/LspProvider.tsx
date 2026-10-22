import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  LSPClient,
  languageServerExtensions,
  type Transport,
} from "@codemirror/lsp-client"

export type LspStatusValue = "connecting" | "connected" | "unavailable"

interface LspContextValue {
  client: LSPClient | null
  status: LspStatusValue
}

const LspContext = createContext<LspContextValue>({ client: null, status: "unavailable" })

export function documentUri(lessonId: string, taskId: string, fileName: string): string {
  const file = fileName
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")
  return `file:///learninglua/lessons/${encodeURIComponent(lessonId)}/tasks/${encodeURIComponent(taskId)}/${file}`
}

function createTransport(socket: WebSocket): Transport & { dispose: () => void } {
  const handlers = new Set<(value: string) => void>()
  const queue: string[] = []

  const flush = () => {
    while (queue.length && socket.readyState === WebSocket.OPEN) {
      socket.send(queue.shift()!)
    }
  }

  socket.addEventListener("open", flush)
  socket.addEventListener("message", (event) => {
    const value = typeof event.data === "string" ? event.data : String(event.data)
    for (const handler of handlers) handler(value)
  })

  return {
    send(message: string) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message)
      else if (socket.readyState === WebSocket.CONNECTING) queue.push(message)
      else throw new Error("lsp_socket_closed")
    },
    subscribe(handler) {
      handlers.add(handler)
    },
    unsubscribe(handler) {
      handlers.delete(handler)
    },
    dispose() {
      handlers.clear()
      queue.length = 0
      socket.removeEventListener("open", flush)
    },
  }
}

export function LspProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<LSPClient | null>(null)
  const [status, setStatus] = useState<LspStatusValue>("connecting")

  useEffect(() => {
    if (import.meta.env.MODE === "test" || typeof WebSocket === "undefined") {
      setStatus("unavailable")
      return
    }

    let disposed = false
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(`${protocol}//${window.location.host}/lsp`)
    const transport = createTransport(socket)
    const lsp = new LSPClient({
      rootUri: "file:///learninglua",
      extensions: languageServerExtensions(),
      timeout: 5000,
    }).connect(transport)

    lsp.initializing
      .then(() => {
        if (!disposed) setStatus("connected")
      })
      .catch(() => {
        if (!disposed) setStatus("unavailable")
      })

    socket.addEventListener("close", () => {
      if (!disposed) setStatus("unavailable")
    })
    socket.addEventListener("error", () => {
      if (!disposed) setStatus("unavailable")
    })

    setClient(lsp)
    setStatus("connecting")

    return () => {
      disposed = true
      try {
        lsp.disconnect()
      } catch {}
      transport.dispose()
      socket.close(1000, "practice_closed")
    }
  }, [])

  const value = useMemo(() => ({ client, status }), [client, status])
  return <LspContext.Provider value={value}>{children}</LspContext.Provider>
}

export function useLspClient() {
  return useContext(LspContext)
}
