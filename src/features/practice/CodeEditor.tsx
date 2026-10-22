import { useEffect, useMemo, useRef } from "react"
import { basicSetup } from "codemirror"
import { EditorState, Compartment } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { StreamLanguage, syntaxHighlighting, HighlightStyle, indentUnit } from "@codemirror/language"
import { lua } from "@codemirror/legacy-modes/mode/lua"
import { cpp } from "@codemirror/lang-cpp"
import { python } from "@codemirror/lang-python"
import { javascript } from "@codemirror/lang-javascript"
import { tags } from "@lezer/highlight"
import type { LSPClient } from "@codemirror/lsp-client"
import type { RuntimeLanguage } from "../../../shared/runtimes"
import { indentUnitFor, type IndentMode } from "./useEditorSettings"
import "./CodeEditor.css"

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-text)",
    fontSize: "13px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--font-mono)",
    lineHeight: "1.75",
  },
  ".cm-content": {
    padding: "18px 0",
    caretColor: "var(--editor-accent)",
  },
  ".cm-line": {
    padding: "0 18px 0 8px",
  },
  ".cm-gutters": {
    border: "0",
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-gutter)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 12px 0 8px",
    minWidth: "34px",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active)",
    color: "var(--editor-text)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--editor-accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(158, 216, 191, .16)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(158, 216, 191, .11)",
  },
  ".cm-panels": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-text)",
    borderColor: "var(--editor-line)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(216, 181, 139, .22)",
  },
})

const luaHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--syntax-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-number)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--syntax-function)" },
  { tag: [tags.variableName, tags.propertyName], color: "var(--syntax-variable)" },
])

function languageExtension(language: RuntimeLanguage) {
  if (language === "lua") return StreamLanguage.define(lua)
  if (language === "cpp") return cpp()
  if (language === "python") return python()
  if (language === "javascript") return javascript()
  return []
}

function indentExtensions(mode: IndentMode) {
  return [indentUnit.of(indentUnitFor(mode)), EditorState.tabSize.of(mode === "2" ? 2 : 4)]
}

export function CodeEditor({
  value,
  onChange,
  indent,
  language = "lua",
  lspClient,
  documentUri,
  ariaLabel = "Редактор кода",
}: {
  value: string
  onChange: (value: string) => void
  indent: IndentMode
  language?: RuntimeLanguage
  lspClient?: LSPClient | null
  documentUri?: string
  ariaLabel?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const indentCompartment = useRef(new Compartment())
  const lspCompartment = useRef(new Compartment())
  onChangeRef.current = onChange
  const lspExtension = useMemo(
    () => (lspClient && documentUri ? lspClient.plugin(documentUri) : []),
    [lspClient, documentUri],
  )

  useEffect(() => {
    if (!host.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          languageExtension(language),
          syntaxHighlighting(luaHighlight),
          EditorView.lineWrapping,
          editorTheme,
          indentCompartment.current.of(indentExtensions(indent)),
          lspCompartment.current.of(lspExtension),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
      parent: host.current,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The editor owns its state after mount; external file changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: indentCompartment.current.reconfigure(indentExtensions(indent)),
    })
  }, [indent])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: lspCompartment.current.reconfigure(lspExtension),
    })
  }, [lspExtension])

  return <div className="code-editor-host" ref={host} />
}
