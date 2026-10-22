import type { Server } from "node:http"
import { WebSocketServer } from "ws"
import { createLspBridge } from "./bridge"

export function attachLspServer(server: Server): WebSocketServer {
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
  wss.on("connection", (ws) => {
    createLspBridge(ws)
  })
  return wss
}
