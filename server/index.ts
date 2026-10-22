import { createServer, type Server } from "node:http"
import { createApp } from "./app"
import { attachLspServer } from "./lsp/server"

const DEFAULT_PORT = 4174

export async function startServer(port = DEFAULT_PORT): Promise<Server> {
  const server = createServer(createApp())
  attachLspServer(server)
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
