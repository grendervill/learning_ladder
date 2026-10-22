import { createServer, type Server } from "node:http"
import { createApp } from "./app"
import { defaultContext } from "./context"
import { classifyAndApply } from "./content/classify"
import { startContentWatcher } from "./content/watcher"
import { emitEvent } from "./events"
import { attachLspServer } from "./lsp/server"
import { getMentorService } from "./mentor/service"
import { finalizeStaleSessions } from "./sessions/lifecycle"

const DEFAULT_PORT = 4174

export async function startServer(port = DEFAULT_PORT): Promise<Server> {
  const context = defaultContext()
  const server = createServer(createApp({ context }))
  attachLspServer(server)

  const watcher = startContentWatcher({
    root: process.cwd(),
    onChange: () => {
      const snapshot = context.refreshCourse?.()
      emitEvent("course:changed", { version: snapshot?.version ?? null })
      if (snapshot && snapshot.unassigned.length > 0) {
        void classifyAndApply(context, getMentorService())
          .then((result) => {
            if (result.applied) {
              emitEvent("course:changed", { version: result.snapshot.version, classified: true })
            }
          })
          .catch((error) => console.error("[content] classification failed", error))
      }
    },
  })
  const sessionSweep = setInterval(() => {
    void finalizeStaleSessions(context, getMentorService()).catch((error) =>
      console.error("[session] idle sweep failed", error),
    )
  }, 60_000)
  sessionSweep.unref()

  server.on("close", () => {
    clearInterval(sessionSweep)
    void watcher.close()
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject)
      resolve()
    })
  })
  return server
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href

if (isEntrypoint) {
  const port = Number(process.env.PORT ?? (process.env.NODE_ENV === "production" ? 4173 : DEFAULT_PORT))
  startServer(port)
    .then(() => {
      console.log(`LearningLua server: http://127.0.0.1:${port}`)
    })
    .catch((error) => {
      console.error("Не удалось запустить сервер:", error)
      process.exit(1)
    })
}
