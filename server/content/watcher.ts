import chokidar, { type FSWatcher } from "chokidar"
import { relative } from "node:path"

export interface WatcherOptions {
  root: string
  onChange: (path: string) => void
  debounceMs?: number
}

export function startContentWatcher({ root, onChange, debounceMs = 1200 }: WatcherOptions): FSWatcher {
  const watcher = chokidar.watch([`${root}/courses`], {
    ignoreInitial: true,
    ignored: [
      "**/node_modules/**",
      "**/data/**",
      "**/.superpowers/**",
      "**/.obsidian/**",
      "**/.git/**",
      "**/.DS_Store",
    ],
  })

  let timer: NodeJS.Timeout | null = null
  const schedule = (path: string) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      onChange(relative(root, path))
    }, debounceMs)
  }

  watcher.on("add", schedule)
  watcher.on("change", schedule)
  watcher.on("unlink", schedule)
  watcher.on("addDir", schedule)
  watcher.on("unlinkDir", schedule)
  return watcher
}
