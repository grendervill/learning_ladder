import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleCheck, LoaderCircle, RotateCcw, Save } from "lucide-react"
import { saveConstructorPrompt, useConstructorPrompt } from "../../lib/courseSettings"

export function ConstructorTab() {
  const promptQuery = useConstructorPrompt()
  const queryClient = useQueryClient()
  const [value, setValue] = useState("")
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (promptQuery.data) {
      setValue(promptQuery.data.prompt)
      setDirty(false)
    }
  }, [promptQuery.data])

  const save = useMutation({
    mutationFn: () => saveConstructorPrompt(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["constructor-prompt"] })
      void queryClient.invalidateQueries({ queryKey: ["settings-checks"] })
      setDirty(false)
      setSavedAt(Date.now())
    },
  })

  const serverValue = promptQuery.data?.prompt ?? ""
  const defaultPrompt = promptQuery.data?.defaultPrompt ?? ""
  const savedRecently = savedAt !== null && !dirty && Date.now() - savedAt < 6000

  return (
    <div className="constructor-panel">
      <div className="settings-mentor-intro">
        <h2>Конструктор курсов</h2>
        <p>
          Этот текст задаёт стиль и педагогику конструктора: как он придумывает карточку,
          собирает программу, выбирает практику и пишет промпт наставника. Точную
          JSON-структуру приложение задаёт само, поэтому промпт можно менять свободно.
        </p>
      </div>

      {promptQuery.isError && (
        <div className="settings-error">
          <p>Не удалось загрузить промпт конструктора.</p>
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
              aria-label="Промпт конструктора"
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
                disabled={!defaultPrompt || save.isPending}
                onClick={() => {
                  setValue(defaultPrompt)
                  setDirty(true)
                  setSavedAt(null)
                }}
              >
                <RotateCcw size={14} aria-hidden />
                Вернуть стандартный
              </button>
              {savedRecently && (
                <span className="settings-saved">
                  <CircleCheck size={14} aria-hidden /> Сохранено
                </span>
              )}
              {save.isError && <span className="settings-save-error">Не удалось сохранить: {save.error.message}</span>}
            </div>
          </>
        )
      )}
    </div>
  )
}
