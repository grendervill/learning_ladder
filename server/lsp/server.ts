import type { Server } from "node:http"
import { WebSocketServer } from "ws"
import type { AppContext } from "../context"
import { createLspBridge } from "./bridge"
import { courseLspOptions } from "./course-lsp"

export function attachLspServer(server: Server, getContext: () => AppContext): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true })
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname
    if (pathname !== "/lsp") {
      socket.destroy()
      return
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request)
    })
  })
  wss.on("connection", (ws, request) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    const options = courseLspOptions(getContext(), url.searchParams.get("courseId"))
    if (!options) {
      ws.close(1011, "lsp_not_configured")
      return
    }
    try {
      createLspBridge(ws, options)
    } catch (error) {
      console.error("[lsp] failed to start", error)
      ws.close(1011, "lsp_start_failed")
    }
  })
  return wss
}
