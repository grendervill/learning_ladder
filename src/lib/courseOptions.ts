import type { CourseIcon, CourseMode, CourseTheme, RuntimeKind } from "./types"

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

export interface RuntimePreset {
  runCommand: string
  lspCommand: string
  lspArgs: string[]
  fileExtension: string
  entry: string
}

export const RUNTIME_PRESETS: Record<RuntimeKind, RuntimePreset> = {
  none: { runCommand: "", lspCommand: "", lspArgs: [], fileExtension: ".txt", entry: "main.txt" },
  lua: {
    runCommand: "lua {file}",
    lspCommand: "lua-language-server",
    lspArgs: [],
    fileExtension: ".lua",
    entry: "main.lua",
  },
  c: {
    runCommand: "gcc {file} -o {bin} && {bin}",
    lspCommand: "clangd",
    lspArgs: [],
    fileExtension: ".c",
    entry: "main.c",
  },
  cpp: {
    runCommand: "g++ {file} -o {bin} && {bin}",
    lspCommand: "clangd",
    lspArgs: [],
    fileExtension: ".cpp",
    entry: "main.cpp",
  },
  python: {
    runCommand: "python3 {file}",
    lspCommand: "pyright-langserver",
    lspArgs: ["--stdio"],
    fileExtension: ".py",
    entry: "main.py",
  },
  javascript: {
    runCommand: "node {file}",
    lspCommand: "typescript-language-server",
    lspArgs: ["--stdio"],
    fileExtension: ".js",
    entry: "main.js",
  },
  custom: { runCommand: "", lspCommand: "", lspArgs: [], fileExtension: ".txt", entry: "main.txt" },
}
