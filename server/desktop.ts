import { startServer } from "./index"

const port = Number(process.env.PORT ?? 4173)

startServer(port)
  .then(() => {
    console.log(`Лестница обучения: сервер http://127.0.0.1:${port}`)
  })
  .catch((error) => {
    console.error("Не удалось запустить сервер:", error)
    process.exit(1)
  })
