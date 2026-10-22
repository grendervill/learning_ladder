let buffer = Buffer.alloc(0)

function send(value) {
  const json = JSON.stringify(value)
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`)
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n")
    if (headerEnd === -1) break
    const header = buffer.subarray(0, headerEnd).toString("ascii")
    const match = header.match(/Content-Length:\s*(\d+)/i)
    if (!match) {
      buffer = buffer.subarray(headerEnd + 4)
      continue
    }
    const start = headerEnd + 4
    const length = Number(match[1])
    if (buffer.length < start + length) break
    const body = buffer.subarray(start, start + length).toString("utf8")
    buffer = buffer.subarray(start + length)
    const message = JSON.parse(body)
    if (message.method === "initialize") {
      send({ jsonrpc: "2.0", id: message.id, result: { capabilities: { textDocumentSync: 1 } } })
    } else if (message.method === "shutdown") {
      send({ jsonrpc: "2.0", id: message.id, result: null })
    } else if (message.method === "exit") {
      process.exit(0)
    }
  }
})
