import type { Response } from "express"

const clients = new Set<Response>()

export function subscribeToEvents(res: Response): void {
  clients.add(res)
  res.write(`event: connected\ndata: {}\n\n`)
}

export function unsubscribeFromEvents(res: Response): void {
  clients.delete(res)
}

export function emitEvent(type: string, data: unknown = {}): void {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    try {
      client.write(payload)
    } catch {
      clients.delete(client)
    }
  }
}
