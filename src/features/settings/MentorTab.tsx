import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, LoaderCircle, RotateCcw, Save } from "lucide-react"
import { saveMentorPrompt, useMentorPrompt } from "../../lib/settings"

export function MentorTab() {
  const promptQuery = useMentorPrompt()
  const queryClient = useQueryClient()
  const [value, setValue] = useState("")
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    if (promptQuery.data) {
      setValue(promptQuery.data.prompt)
      setDirty(false)
    }
  }, [promptQuery.data])

  const save = useMutation({
    mutationFn: () => saveMentorPrompt(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings-mentor-prompt"] })
      setDirty(false)
      setSavedAt(Date.now())
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSavedAt(null), 4000)
    },
  })

  const serverValue = promptQuery.data?.prompt ?? ""
  const savedRecently = savedAt !== null && !dirty && Date.now() - savedAt < 6000

  return (
    <div className="mentor-panel">
      <div className="settings-mentor-intro">
        <h2>Промпт наставника</h2>
        <p>
          Этот текст задаёт характер и правила учителя: как он объясняет, как проверяет и почему
          не даёт готовый код. Он используется и локальным OpenCode, и прямыми подключениями к
          нейросетям. Изменения применятся к новым обращениям.
        </p>
      </div>

      {promptQuery.isError && (
        <div className="settings-error">
          <p>Не удалось загрузить промпт.</p>
          <button type="button" className="settings-button settings-button--ghost" onClick={() => void promptQuery.refetch()}>
            Повторить
          </button>
        </div>
      )}

      {promptQuery.isLoading ? (
        <div className="mentor-skeleton" />
      ) : (
        !promptQuery.isError && (
          <>
            <textarea
              className="mentor-textarea"
              value={value}
              spellCheck={false}
              aria-label="Промпт наставника"
              onChange={(event) => {
                setValue(event.target.value)
                setDirty(true)
                setSavedAt(null)
              }}
            />
            <div className="mentor-meta">
              <span>{value.length} символов</span>
              {promptQuery.data?.path && <span className="mentor-meta__path">{promptQuery.data.path}</span>}
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="settings-button settings-button--primary"
                disabled={!dirty || save.isPending || !value.trim()}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Save size={14} aria-hidden />}
                {save.isPending ? "Сохраняем…" : "Сохранить промпт"}
              </button>
              <button
                type="button"
                className="settings-button settings-button--ghost"
                disabled={!dirty}
                onClick={() => {
                  setValue(serverValue)
                  setDirty(false)
                }}
              >
                <RotateCcw size={14} aria-hidden />
                Вернуть как было
              </button>
              {savedRecently && (
                <span className="settings-saved">
                  <CircleCheck size={14} aria-hidden /> Сохранено
                </span>
              )}
              {save.isError && <span className="settings-save-error">Не удалось сохранить: {String(save.error.message)}</span>}
            </div>
          </>
        )
      )}
    </div>
  )
}
