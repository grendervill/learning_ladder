export const COURSE_THEMES = ["forest", "amber", "ocean", "plum", "clay"] as const
export type CourseTheme = (typeof COURSE_THEMES)[number]

export const COURSE_ICONS = [
  "book",
  "code",
  "chart",
  "globe",
  "atom",
  "scale",
  "palette",
  "heart",
] as const
export type CourseIcon = (typeof COURSE_ICONS)[number]

export const COURSE_MODES = ["general", "math", "programming"] as const
export type CourseMode = (typeof COURSE_MODES)[number]

export const RUNTIME_KINDS = [
  "none",
  "lua",
  "c",
  "cpp",
  "python",
  "javascript",
  "custom",
] as const
export type RuntimeKind = (typeof RUNTIME_KINDS)[number]

export type RuntimeLanguage = "lua" | "cpp" | "python" | "javascript" | "text"

export interface CourseSettings {
  runtime: RuntimeKind
  runCommand: string
  lspCommand: string
  lspArgs: string[]
  fileExtension: string
  entry: string
}

export interface RuntimePreset {
  label: string
  hint: string
  runCommand: string
  lspCommand: string
  lspArgs: string[]
  fileExtension: string
  entry: string
  language: RuntimeLanguage
}

export const RUNTIME_PRESETS: Record<RuntimeKind, RuntimePreset> = {
  none: {
    label: "Без запуска",
    hint: "текст и разбор",
    runCommand: "",
    lspCommand: "",
    lspArgs: [],
    fileExtension: ".txt",
    entry: "main.txt",
    language: "text",
  },
  lua: {
    label: "Lua",
    hint: "lua · lua-language-server",
    runCommand: "lua {file}",
    lspCommand: "lua-language-server",
    lspArgs: [],
    fileExtension: ".lua",
    entry: "main.lua",
    language: "lua",
  },
  c: {
    label: "C",
    hint: "gcc · clangd",
    runCommand: "gcc {file} -o {bin} && {bin}",
    lspCommand: "clangd",
    lspArgs: [],
    fileExtension: ".c",
    entry: "main.c",
    language: "cpp",
  },
  cpp: {
    label: "C++",
    hint: "g++ · clangd",
    runCommand: "g++ {file} -o {bin} && {bin}",
    lspCommand: "clangd",
    lspArgs: [],
    fileExtension: ".cpp",
    entry: "main.cpp",
    language: "cpp",
  },
  python: {
    label: "Python",
    hint: "python3 · pyright",
    runCommand: "python3 {file}",
    lspCommand: "pyright-langserver",
    lspArgs: ["--stdio"],
    fileExtension: ".py",
    entry: "main.py",
    language: "python",
  },
  javascript: {
    label: "JavaScript",
    hint: "node · typescript-language-server",
    runCommand: "node {file}",
    lspCommand: "typescript-language-server",
    lspArgs: ["--stdio"],
    fileExtension: ".js",
    entry: "main.js",
    language: "javascript",
  },
  custom: {
    label: "Своя команда",
    hint: "команда и LSP настраиваются в курсе",
    runCommand: "",
    lspCommand: "",
    lspArgs: [],
    fileExtension: ".txt",
    entry: "main.txt",
    language: "text",
  },
}

export const THEME_OPTIONS: Array<{ value: CourseTheme; label: string }> = [
  { value: "forest", label: "Лес" },
  { value: "amber", label: "Янтарь" },
  { value: "ocean", label: "Океан" },
  { value: "plum", label: "Слива" },
  { value: "clay", label: "Терракота" },
]

export const ICON_OPTIONS: Array<{ value: CourseIcon; label: string }> = [
  { value: "book", label: "Книга" },
  { value: "code", label: "Код" },
  { value: "chart", label: "График" },
  { value: "globe", label: "Глобус" },
  { value: "atom", label: "Атом" },
  { value: "scale", label: "Весы" },
  { value: "palette", label: "Палитра" },
  { value: "heart", label: "Сердце" },
]

export const MODE_OPTIONS: Array<{ value: CourseMode; label: string }> = [
  { value: "general", label: "Разбор и квиз 50/50" },
  { value: "math", label: "Математика: шаги решения" },
  { value: "programming", label: "Программирование: код и запуск" },
]

export const RUNTIME_OPTIONS: Array<{ value: RuntimeKind; label: string }> = [
  { value: "none", label: "Без запуска кода" },
  { value: "lua", label: "Lua" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "custom", label: "Своя команда" },
]

export function settingsForRuntime(runtime: RuntimeKind): CourseSettings {
  const preset = RUNTIME_PRESETS[runtime]
  return {
    runtime,
    runCommand: preset.runCommand,
    lspCommand: preset.lspCommand,
    lspArgs: [...preset.lspArgs],
    fileExtension: preset.fileExtension,
    entry: preset.entry,
  }
}

export function runtimeLanguage(runtime: RuntimeKind): RuntimeLanguage {
  return RUNTIME_PRESETS[runtime].language
}

export function runtimeLabel(runtime: RuntimeKind): string {
  return RUNTIME_PRESETS[runtime].label
}
