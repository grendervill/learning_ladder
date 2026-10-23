import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronDown,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Play,
  Terminal,
  Trash2,
} from "lucide-react"
import { fetchJson } from "../../lib/api"
import { runtimeLabel } from "../../lib/courseOptions"
import type { RuntimeKind } from "../../lib/types"
import "./RunPanel.css"

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  timedOut: boolean
  syntaxError: boolean
}

function parseArgs(raw: string): string[] {
  const matches = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []
  return matches.map((value) => value.replace(/^"|"$/g, ""))
}

export function RunPanel({
  lessonId,
  taskId,
  files,
  kind,
  runtime = "lua",
}: {
  lessonId: string
  taskId: string
  files: Array<{ name: string; content: string }>
  kind: "code" | "terminal" | "love" | "project"
  runtime?: RuntimeKind
}) {
  const [args, setArgs] = useState("")
  const [stdin, setStdin] = useState("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const runningRef = useRef(false)

  const run = useCallback(async () => {
    if (runningRef.current || kind === "terminal") return
    runningRef.current = true
    setRunning(true)
    setError(null)
    try {
      const response = await fetchJson<RunResult>(`/api/tasks/${lessonId}/${taskId}/run`, {
        method: "POST",
        body: JSON.stringify({
          files,
          args: parseArgs(args),
          stdin,
        }),
      })
      setResult(response)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "run_failed")
    } finally {
      runningRef.current = false
      setRunning(false)
    }
  }, [args, files, kind, lessonId, stdin, taskId])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault()
        void run()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [run])

  return (
    <section className="run-panel" aria-label="Запуск задания">
      <div className="run-panel__head">
        <div className="run-panel__title">
          <Terminal size={14} aria-hidden />
          <span>Консоль</span>
          <small>{kind === "love" ? "предпросмотр" : runtimeLabel(runtime)}</small>
        </div>
        <div className="run-panel__actions">
          <span className="run-panel__shortcut">Ctrl + Enter</span>
          <button
            type="button"
            className="run-panel__clear"
            onClick={() => {
              setResult(null)
              setError(null)
            }}
            disabled={!result && !error}
            title="Очистить вывод"
          >
            <Trash2 size={12} aria-hidden />
          </button>
          <button type="button" className="run-panel__run" onClick={() => void run()} disabled={running || kind === "terminal"}>
            {running ? <LoaderCircle size={12} className="spin" aria-hidden /> : <Play size={12} aria-hidden />}
            {running ? "Запускаем" : "Проверить"}
          </button>
        </div>
      </div>

      <details className="run-inputs">
        <summary>
          <span>Входные данные</span>
          <span>stdin и аргументы</span>
          <ChevronDown size={13} aria-hidden />
        </summary>
        <div className="run-inputs__body">
          <label>
            <span>Аргументы командной строки</span>
            <input
              value={args}
              onChange={(event) => setArgs(event.target.value)}
              placeholder='например: add "моя запись"'
              spellCheck={false}
            />
          </label>
          <label>
            <span>Стандартный ввод (stdin)</span>
            <textarea
              value={stdin}
              onChange={(event) => setStdin(event.target.value)}
              placeholder="То, что программа прочитает со стандартного ввода"
              rows={3}
              spellCheck={false}
            />
          </label>
        </div>
      </details>

      <div className="run-console" aria-live="polite">
        {!result && !error && (
          <div className="run-console__empty">
            <Terminal size={15} aria-hidden />
            <span>Здесь появится вывод. Проверь код, когда будешь готов.</span>
          </div>
        )}
        {error && (
          <div className="run-console__error">
            <CircleAlert size={14} aria-hidden />
            <span>{error === "love_preview_is_client_side" ? "Для LÖVE используется предпросмотр." : error === "runtime_not_configured" ? "В настройках курса не задана команда запуска." : `Не удалось запустить: ${error}`}</span>
          </div>
        )}
        {result && (
          <>
            <pre className="run-console__stdout">{result.stdout || "(пустой stdout)"}</pre>
            {result.stderr && <pre className="run-console__stderr">{result.stderr}</pre>}
            <div className="run-console__footer">
              <span className={result.exitCode === 0 && !result.timedOut ? "ok" : "bad"}>
                {result.timedOut ? "остановлено по таймауту" : `exit ${result.exitCode}`}
              </span>
              {result.syntaxError && <span>синтаксис</span>}
              <span>
                <Clock3 size={10} aria-hidden /> {result.durationMs} мс
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
