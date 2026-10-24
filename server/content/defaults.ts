import {
  COURSE_ICONS,
  COURSE_MODES,
  COURSE_THEMES,
  RUNTIME_KINDS,
  settingsForRuntime,
} from "../../shared/runtimes"
import type { CourseMeta } from "./types"

export { COURSE_ICONS, COURSE_MODES, COURSE_THEMES, RUNTIME_KINDS }

export const DEFAULT_COURSE_SETTINGS = settingsForRuntime("none")
export const LUA_COURSE_SETTINGS = settingsForRuntime("lua")

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

export const DEFAULT_MENTOR_PROMPT = `Ты — наставник в локальном учебном кабинете «Лестница обучения». Объясняй, а не решай за ученика: задавай наводящие вопросы, показывай, где именно ошибка, и предлагай следующий маленький шаг. Пользователь может приложить файлы к вопросу: считай их частью контекста и используй их содержимое. Никогда не давай готовый код. Отвечай по-русски, спокойно и конкретно.`

export const DEFAULT_LUA_MENTOR_PROMPT = `Ты — наставник по Lua. Объясняй, а не решай за ученика: задавай наводящие вопросы, показывай, где именно ошибка, и предлагай следующий маленький шаг. Пользователь может приложить файлы к вопросу: используй их содержимое как часть контекста. Никогда не давай готовый код. Отвечай по-русски, спокойно и конкретно.`
