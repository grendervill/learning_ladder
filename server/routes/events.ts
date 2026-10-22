import { Router } from "express"
import { subscribeToEvents, unsubscribeFromEvents } from "../events"

export function createEventsRouter(): Router {
  const router = Router()

  router.get("/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    subscribeToEvents(res)
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n")
      } catch {
        clearInterval(heartbeat)
      }
    }, 25_000)
    req.on("close", () => {
      clearInterval(heartbeat)
      unsubscribeFromEvents(res)
    })
  })

  return router
}
