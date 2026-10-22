import { SlidersHorizontal } from "lucide-react"
import type { IndentMode } from "./useEditorSettings"

export function EditorSettings({
  indent,
  onChange,
}: {
  indent: IndentMode
  onChange: (mode: IndentMode) => void
}) {
  return (
    <label className="editor-settings">
      <SlidersHorizontal size={12} aria-hidden />
      <span>Отступ</span>
      <select
        value={indent}
        onChange={(event) => onChange(event.target.value as IndentMode)}
        aria-label="Размер отступа"
      >
        <option value="2">2 пробела</option>
        <option value="4">4 пробела</option>
        <option value="tab">таб</option>
      </select>
    </label>
  )
}
