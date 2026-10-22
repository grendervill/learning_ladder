import type { CourseSettings, RuntimeKind } from "../content/types"

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

export function settingsForRuntime(runtime: RuntimeKind): CourseSettings {
  return { runtime, ...RUNTIME_PRESETS[runtime] }
}
