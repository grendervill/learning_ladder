import { useState } from "react"

export type IndentMode = "2" | "4" | "tab"

const KEY = "learninglua.indent"

export function indentUnitFor(mode: IndentMode): string {
  if (mode === "tab") return "\t"
  if (mode === "4") return "    "
  return "  "
}

export function useEditorSettings() {
  const [indent, setIndentState] = useState<IndentMode>(() => {
    const saved = window.localStorage.getItem(KEY)
    return saved === "2" || saved === "4" || saved === "tab" ? saved : "2"
  })

  const setIndent = (mode: IndentMode) => {
    window.localStorage.setItem(KEY, mode)
    setIndentState(mode)
  }

  return { indent, setIndent }
}
