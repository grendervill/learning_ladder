import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { FolderOpen, LoaderCircle, Save, TriangleAlert } from "lucide-react"
import { fetchJson } from "../../lib/api"
import { useProject } from "../../lib/useProject"

export function ProjectTab({ onSwitched }: { onSwitched?: () => void }) {
  const project = useProject()
  const [root, setRoot] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (project.data?.root) setRoot(project.data.root)
  }, [project.data?.root])

  const switchProject = useMutation({
    mutationFn: (next: string) =>
      fetchJson<{ root: string; courses: number }>("/api/project", {
        method: "PUT",
        body: JSON.stringify({ root: next }),
      }),
    onSuccess: () => {
      setSaved(true)
      if (onSwitched) onSwitched()
      else window.location.reload()
    },
  })

  if (project.isLoading) {
    return <div className="network-skeleton" />
  }

  if (project.isError || !project.data) {
    return (
      <div className="settings-error">
        <p>Не удалось прочитать папку проекта.</p>
        <button type="button" className="settings-button settings-button--ghost" onClick={() => void project.refetch()}>
          Повторить
        </button>
      </div>
    )
  }

  return (
    <div className="project-panel">
      <div className="project-summary">
        <span className="project-summary__icon" aria-hidden>
          <FolderOpen size={22} strokeWidth={1.7} />
        </span>
        <div>
          <h2>Папка проекта</h2>
          <p>
            Здесь лежат настройки программы, промпты, курсы — каждый в своей папке —
            и прогресс. При смене папки программа переключится на неё целиком;
            старая папка останется на месте.
          </p>
          <code>{project.data.root}</code>
        </div>
      </div>

      <div className="project-stats">
        <span>курсов: {project.data.courses}</span>
        <span>{project.data.exists ? "папка существует" : "папка будет создана"}</span>
        <span>{project.data.writable ? "запись разрешена" : "нет прав на запись"}</span>
      </div>

      <label className="settings-field">
        <span className="settings-field__label">Новый путь</span>
        <input
          className="settings-input"
          value={root}
          onChange={(event) => {
            setRoot(event.target.value)
            setSaved(false)
          }}
          placeholder="/Users/you/Documents/Лестница обучения"
          aria-label="Путь к папке проекта"
        />
        <span className="settings-field__hint">
          Можно вставить абсолютный путь. Несуществующая папка будет создана с нужными
          подкаталогами.
        </span>
      </label>

      <div className="project-warning">
        <TriangleAlert size={15} aria-hidden />
        <span>После переключения страница перезагрузится, чтобы не осталось старых данных.</span>
      </div>

      <div className="settings-actions">
        <button
          type="button"
          className="settings-button settings-button--primary"
          disabled={!root.trim() || switchProject.isPending}
          onClick={() => switchProject.mutate(root.trim())}
        >
          {switchProject.isPending ? (
            <LoaderCircle size={14} className="spin" aria-hidden />
          ) : (
            <Save size={14} aria-hidden />
          )}
          {switchProject.isPending ? "Переключаем…" : "Сменить папку проекта"}
        </button>
        {saved && <span className="settings-saved">Папка переключена</span>}
        {switchProject.isError && (
          <span className="settings-save-error">
            Не удалось переключить: {switchProject.error.message}
          </span>
        )}
      </div>
    </div>
  )
}
