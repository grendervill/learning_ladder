import type { CourseMeta, CourseSettings, CourseTheme, CourseIcon } from "./types"

export const COURSE_THEMES: CourseTheme[] = ["forest", "amber", "ocean", "plum", "clay"]
export const COURSE_ICONS: CourseIcon[] = [
  "book",
  "code",
  "chart",
  "globe",
  "atom",
  "scale",
  "palette",
  "heart",
]

export const DEFAULT_COURSE_SETTINGS: CourseSettings = {
  runtime: "none",
  runCommand: "",
  lspCommand: "",
  lspArgs: [],
  fileExtension: ".txt",
  entry: "main.txt",
}

export const LUA_COURSE_SETTINGS: CourseSettings = {
  runtime: "lua",
  runCommand: "lua {file}",
  lspCommand: "lua-language-server",
  lspArgs: [],
  fileExtension: ".lua",
  entry: "main.lua",
}

export const DEFAULT_LUA_COURSE_META: CourseMeta = {
  format: "legacy",
  id: "lua",
  title: "Lua",
  description:
    "Язык программирования Lua: от первого запуска и типов данных до метатаблиц, корутин и финального проекта.",
  theme: "forest",
  icon: "code",
  mode: "programming",
  settings: LUA_COURSE_SETTINGS,
  builtIn: true,
  createdAt: "2026-10-22T00:00:00.000Z",
}

export const DEFAULT_COURSE_META: CourseMeta = {
  id: "course",
  title: "Новый курс",
  description: "",
  theme: "forest",
  icon: "book",
  mode: "general",
  settings: DEFAULT_COURSE_SETTINGS,
  builtIn: false,
  createdAt: "2026-10-22T00:00:00.000Z",
}

export const DEFAULT_MENTOR_PROMPT = `Ты — наставник в локальном учебном кабинете «Лестница обучения». Объясняй, а не решай за ученика: задавай наводящие вопросы, показывай, где именно ошибка, и предлагай следующий маленький шаг. Никогда не давай готовый код. Отвечай по-русски, спокойно и конкретно.`

export const DEFAULT_LUA_MENTOR_PROMPT = `Ты — наставник по Lua. Объясняй, а не решай за ученика: задавай наводящие вопросы, показывай, где именно ошибка, и предлагай следующий маленький шаг. Никогда не давай готовый код. Отвечай по-русски, спокойно и конкретно.`
