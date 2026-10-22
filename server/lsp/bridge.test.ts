import { resolve } from "node:path"
import { once } from "node:events"
import { WebSocket, WebSocketServer } from "ws"
import type { AddressInfo } from "node:net"
import { describe, expect, it } from "vitest"
import { createLspBridge } from "./bridge"
import { LspFrameParser, encodeLspFrame } from "./frames"

describe("LSP frames", () => {
  it("parses split and combined frames", () => {
    const parser = new LspFrameParser()
    const first = encodeLspFrame('{"id":1}')
    const second = encodeLspFrame('{"id":2}')
    expect(parser.push(first.subarray(0, 5))).toEqual([])
    expect(parser.push(Buffer.concat([first.subarray(5), second]))).toEqual(['{"id":1}', '{"id":2}'])
  })
})

describe("LSP bridge", () => {
  it("forwards messages to a language server", async () => {
    const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" })
    const fakePath = resolve(process.cwd(), "server/lsp/__fixtures__/fake-lsp.cjs")
    wss.on("connection", (ws) => {
      createLspBridge(ws, { command: process.execPath, args: [fakePath] })
    })
    await once(wss, "listening")
    const port = (wss.address() as AddressInfo).port
    const client = new WebSocket(`ws://127.0.0.1:${port}`)
    try {
      await once(client, "open")
      client.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }))
      const message = await new Promise<any>((resolveMessage, reject) => {
        const timer = setTimeout(() => reject(new Error("lsp response timeout")), 3000)
        client.on("message", (data) => {
          const parsed = JSON.parse(data.toString())
          if (parsed.id === 1) {
            clearTimeout(timer)
            resolveMessage(parsed)
          }
        })
      })
      expect(message.result.capabilities).toBeDefined()
    } finally {
      client.close()
      wss.close()
    }
  })
})
