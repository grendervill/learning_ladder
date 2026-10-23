import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { DEFAULT_LUA_COURSE_META, DEFAULT_LUA_MENTOR_PROMPT } from "./content/defaults"

export interface ProjectPaths {
  root: string
  dataDir: string
  settingsPath: string
  dbPath: string
  workspacesDir: string
  coursesDir: string
  promptsDir: string
  reportsDir: string
  constructorPromptPath: string
  configPath: string
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

const COURSE_MENTOR_AGENT = `---
description: Наставник курса в «Лестнице обучения»
mode: primary
hidden: true
steps: 2
permissions:
  - action: "*"
    resource: "*"
    effect: deny
---

Ты — наставник в локальном учебном кабинете «Лестница обучения». Работай только
с тем курсом и тем контекстом, которые переданы в запросе. Не выдумывай факты,
которых нет в материалах. Объясняй, задавай наводящие вопросы и не давай готовое
решение. Отвечай по-русски, спокойно и конкретно.
`

const COURSE_CONSTRUCTOR_AGENT = `---
description: Конструктор курсов в «Лестнице обучения»
mode: primary
hidden: true
steps: 1
permissions:
  - action: "*"
    resource: "*"
    effect: deny
---

Ты — методист и конструктор курсов в «Лестнице обучения». Создавай карточку
курса, структуру и наполнение по запросу пользователя. Соблюдай инструкции
приложения и возвращай только запрошенный JSON без Markdown-обёртки. Не
выдумывай факты; если данных мало, принимай разумные решения и помечай
предположения в тексте курса. Отвечай по-русски.
`

export function appConfigPath(): string {
  if (process.env.LEARNINGLUA_CONFIG) return resolve(process.env.LEARNINGLUA_CONFIG)
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "learning-ladder", "config.json")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "learning-ladder", "config.json")
}

export function resolveProjectPaths(root: string): ProjectPaths {
  const absolute = resolve(root)
  const dataDir = join(absolute, "data")
  return {
    root: absolute,
    dataDir,
    settingsPath: join(dataDir, "settings.json"),
    dbPath: join(dataDir, "learninglua.db"),
    workspacesDir: join(dataDir, "workspaces"),
    coursesDir: join(absolute, "courses"),
    promptsDir: join(absolute, "prompts"),
    reportsDir: join(absolute, "reports"),
    constructorPromptPath: join(absolute, "prompts", "constructor.md"),
    configPath: appConfigPath(),
  }
}

export function readConfiguredProjectRoot(fallback: string): string {
  const path = appConfigPath()
  if (!existsSync(path)) return resolve(fallback)
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { projectRoot?: unknown }
    if (typeof parsed.projectRoot === "string" && parsed.projectRoot.trim()) {
      return resolve(parsed.projectRoot)
    }
  } catch {
    // A damaged config should not make the app unstartable.
  }
  return resolve(fallback)
}

export function writeConfiguredProjectRoot(root: string): void {
  const path = appConfigPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ projectRoot: resolve(root) }, null, 2)}\n`, "utf8")
}

function writeAgentIfMissing(root: string, name: string, content: string): void {
  const path = join(root, ".opencode", "agents", name)
  if (!existsSync(path)) writeFileSync(path, content, "utf8")
}

export function ensureProjectLayout(root: string): ProjectPaths {
  const paths = resolveProjectPaths(root)
  // Throws for an existing non-directory root, which is the desired failure.
  mkdirSync(paths.root, { recursive: true })
  for (const path of [
    paths.dataDir,
    paths.workspacesDir,
    paths.coursesDir,
    paths.promptsDir,
    paths.reportsDir,
  ]) {
    mkdirSync(path, { recursive: true })
  }
  mkdirSync(join(paths.root, ".opencode", "agents"), { recursive: true })
  writeAgentIfMissing(paths.root, "course-mentor.md", COURSE_MENTOR_AGENT)
  writeAgentIfMissing(paths.root, "course-constructor.md", COURSE_CONSTRUCTOR_AGENT)
  return paths
}

export function migrateLegacyLua(root: string): boolean {
  const paths = resolveProjectPaths(root)
  const luaDir = join(paths.coursesDir, "lua")
  const legacyLessons = join(paths.root, "lessons")
  const legacyCourse = join(paths.root, "course")
  if (existsSync(luaDir)) return false
  if (!existsSync(legacyLessons) && !existsSync(legacyCourse)) return false

  mkdirSync(luaDir, { recursive: true })
  if (existsSync(legacyLessons)) renameSync(legacyLessons, join(luaDir, "lessons"))
  if (existsSync(legacyCourse)) renameSync(legacyCourse, join(luaDir, "course"))

  const mentorSource = join(paths.root, ".opencode", "agents", "lua-mentor.md")
  let mentor = DEFAULT_LUA_MENTOR_PROMPT
  if (existsSync(mentorSource)) {
    const raw = readFileSync(mentorSource, "utf8")
    const body = raw.replace(FRONTMATTER, "").trim()
    if (body) mentor = body
  }
  writeFileSync(join(luaDir, "mentor.md"), `${mentor}\n`, "utf8")
  writeFileSync(
    join(luaDir, "course.json"),
    `${JSON.stringify(DEFAULT_LUA_COURSE_META, null, 2)}\n`,
    "utf8",
  )
  return true
}
