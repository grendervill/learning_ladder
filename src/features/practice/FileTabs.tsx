import { FileCode2, Plus } from "lucide-react"

export function FileTabs({
  files,
  activeFile,
  canAdd,
  onSelect,
  onAdd,
}: {
  files: Array<{ name: string }>
  activeFile: string
  canAdd: boolean
  onSelect: (name: string) => void
  onAdd: () => void
}) {
  return (
    <div className="file-tabs-row">
      <div className="file-tabs" role="tablist" aria-label="Файлы задания">
        {files.map((file) => (
          <button
            key={file.name}
            type="button"
            role="tab"
            aria-selected={activeFile === file.name}
            className={`file-tab${activeFile === file.name ? " is-active" : ""}`}
            onClick={() => onSelect(file.name)}
          >
            <FileCode2 size={11} aria-hidden />
            <span>{file.name}</span>
          </button>
        ))}
      </div>
      {canAdd && (
        <button type="button" className="file-add" onClick={onAdd} aria-label="Добавить файл">
          <Plus size={12} aria-hidden /> файл
        </button>
      )}
    </div>
  )
}
