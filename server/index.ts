import { createServer, type Server } from "node:http"
import { resolve } from "node:path"
import type { FSWatcher } from "chokidar"
import { createApp } from "./app"
import { cleanupExpiredAttachments } from "./attachments/store"
import { defaultContext, type AppContext } from "./context"
import { classifyAndApply } from "./content/classify"
import { startContentWatcher } from "./content/watcher"
import { emitEvent } from "./events"
import { attachLspServer } from "./lsp/server"
import { getMentorService } from "./mentor/service"
import { createProjectManager, type ProjectManager } from "./project-controller"
import {
  isForeignAbsolutePath,
  projectRootCandidates,
  readConfiguredProjectRoot,
  resolveUsableProjectRoot,
  type ProjectStatus,
} from "./project"
import { finalizeStaleSessions } from "./sessions/lifecycle"

const DEFAULT_PORT = 4174

export async function startServer(port = DEFAULT_PORT): Promise<Server> {
  const staticRoot = process.env.LEARNINGLUA_STATIC_ROOT ?? process.cwd()
  const fallbackProjectRoot = resolve(process.env.LEARNINGLUA_PROJECT_ROOT ?? process.cwd())
  const configuredRoot = readConfiguredProjectRoot(fallbackProjectRoot)
  const resolved = resolveUsableProjectRoot(
    projectRootCandidates(fallbackProjectRoot, configuredRoot),
  )
  const projectRoot = resolved.root
  const foreignRoot = isForeignAbsolutePath(configuredRoot)
  const fallbackError = foreignRoot
    ? `Сохранённая папка ${configuredRoot} относится к другой ОС; используется ${projectRoot}`
    : resolved.error
      ? `Сохранённая папка ${configuredRoot} недоступна: ${resolved.error}`
      : projectRoot !== configuredRoot
        ? `Сохранённая папка ${configuredRoot} недоступна; используется ${projectRoot}`
        : undefined
  const projectState: ProjectStatus = {
    defaultRoot: fallbackProjectRoot,
    activeRoot: projectRoot,
    configuredRoot,
    ...(fallbackError ? { fallbackError } : {}),
  }
  if (fallbackError) console.error(`[project] ${fallbackError}`)
  const removed = cleanupExpiredAttachments(projectRoot)
  if (removed > 0) console.log(`[attachments] удалено временных наборов: ${removed}`)
  if (resolve(projectRoot) !== resolve(process.cwd())) {
    process.chdir(projectRoot)
  }

  const initialContext = defaultContext()
  let watcher: FSWatcher | null = null

  const startWatcher = (context: AppContext): FSWatcher =>
    startContentWatcher({
      root: context.root ?? process.cwd(),
      onChange: () => {
        const snapshot = context.refreshCourse?.()
        emitEvent("course:changed", { version: snapshot?.version ?? null })
        if (snapshot && snapshot.unassigned.length > 0) {
          void classifyAndApply(context, getMentorService())
            .then((result) => {
              if (result.applied) {
                emitEvent("course:changed", {
                  version: result.snapshot.version,
                  classified: true,
                })
              }
            })
            .catch((error) => console.error("[content] classification failed", error))
        }
      },
    })

  watcher = startWatcher(initialContext)

  const manager: ProjectManager = createProjectManager({
    initialContext,
    onAfterSwitch: (context) => {
      void watcher?.close()
      watcher = startWatcher(context)
      projectState.activeRoot = context.root ?? process.cwd()
      projectState.configuredRoot = projectState.activeRoot
      delete projectState.fallbackError
      const removed = cleanupExpiredAttachments(projectState.activeRoot)
      if (removed > 0) console.log(`[attachments] удалено временных наборов: ${removed}`)
      emitEvent("project:changed", { root: context.root ?? process.cwd() })
      emitEvent("course:changed", { version: context.getCourse().version })
    },
  })

  const server = createServer(
    createApp({
      getContext: () => manager.getContext(),
      project: manager,
      projectStatus: () => projectState,
      staticRoot,
    }),
  )
  attachLspServer(server, () => manager.getContext())

  const sessionSweep = setInterval(() => {
    void finalizeStaleSessions(manager.getContext(), getMentorService()).catch((error) =>
      console.error("[session] idle sweep failed", error),
    )
  }, 60_000)
  sessionSweep.unref()

  server.on("close", () => {
    clearInterval(sessionSweep)
    void watcher?.close()
  })

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject)
      resolveListen()
    })
  })
  return server
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href

if (isEntrypoint) {
  const port = Number(process.env.PORT ?? (process.env.NODE_ENV === "production" ? 4173 : DEFAULT_PORT))
  startServer(port)
    .then(() => {
      console.log(`Лестница обучения: сервер http://127.0.0.1:${port}`)
    })
    .catch((error) => {
      console.error("Не удалось запустить сервер:", error)
      process.exit(1)
    })
}
