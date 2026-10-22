import { useEffect, useRef, useState } from "react"
import {
  CircleAlert,
  Eraser,
  LoaderCircle,
  Play,
  Terminal,
} from "lucide-react"
import { fetchJson } from "../../lib/api"
import "./TerminalPanel.css"

interface TerminalEntry {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  timedOut?: boolean
}

interface TerminalState {
  cwd: string
  history: Array<TerminalEntry & { createdAt?: string }>
}

const SUGGESTIONS = ["pwd", "ls", "mkdir demo", "cd demo", "cd ..", "lua --version"]

export function TerminalPanel({ lessonId, taskId }: { lessonId: string; taskId: string }) {
  const [cwd, setCwd] = useState("")
  const [entries, setEntries] = useState<TerminalEntry[]>([])
  const [input, setInput] = useState("")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<TerminalState>(`/api/tasks/${lessonId}/${taskId}/terminal`)
      .then((state) => {
        if (cancelled) return
        setCwd(state.cwd)
        setEntries(state.history)
        setHistory(state.history.map((entry) => entry.command))
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть терминал.")
      })
    return () => {
      cancelled = true
    }
  }, [lessonId, taskId])

  useEffect(() => {
    const output = outputRef.current
    if (!output) return
    if (typeof output.scrollTo === "function") {
      output.scrollTo({ top: output.scrollHeight })
    } else {
      output.scrollTop = output.scrollHeight
    }
  }, [entries, running])

  const run = async () => {
    const command = input.trim()
    if (!command || running) return
    setInput("")
    setRunning(true)
    setError(null)
    try {
      const result = await fetchJson<TerminalEntry & { cwd: string }>(
        `/api/tasks/${lessonId}/${taskId}/terminal`,
        { method: "POST", body: JSON.stringify({ command }) },
      )
      setCwd(result.cwd)
      setEntries((current) => [
        ...current,
        {
          command,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
        },
      ])
      setHistory((current) => [...current, command])
      setHistoryIndex(-1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Команда не выполнилась")
    } finally {
      setRunning(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      void run()
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      if (!history.length) return
      const next = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setInput(history[next])
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (historyIndex === -1) return
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(-1)
        setInput("")
      } else {
        setHistoryIndex(next)
        setInput(history[next])
      }
      return
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault()
      setEntries([])
    }
  }

  const cwdLabel = cwd.split("/").slice(-2).join("/") || "~"

  return (
    <section className="terminal-panel" aria-label="Терминал задания">
      <div className="terminal-head">
        <div className="terminal-head__title">
          <Terminal size={14} aria-hidden />
          <span>Терминал</span>
          <small title={cwd}>{cwdLabel}</small>
        </div>
        <div className="terminal-head__actions">
          <span>Ctrl + L — очистить</span>
          <button type="button" onClick={() => setEntries([])} disabled={!entries.length} title="Очистить вывод">
            <Eraser size={12} aria-hidden />
          </button>
        </div>
      </div>

      <div className="terminal-output" ref={outputRef} aria-live="polite">
        {entries.length === 0 && !running && (
          <div className="terminal-welcome">
            <span className="terminal-prompt">$</span>
            <p>
              Это терминал задания. Команды выполняются в его рабочей папке. Начни с{" "}
              <button type="button" onClick={() => setInput("pwd")}>pwd</button>.
            </p>
          </div>
        )}
        {entries.map((entry, index) => (
          <div className="terminal-entry" key={`${entry.command}-${index}`}>
            <div className="terminal-cmd">
              <span className="terminal-prompt">$</span>
              <span>{entry.command}</span>
            </div>
            {entry.stdout && <pre className="terminal-stdout">{entry.stdout.replace(/\s+$/, "")}</pre>}
            {entry.stderr && <pre className="terminal-stderr">{entry.stderr.replace(/\s+$/, "")}</pre>}
            <div className={`terminal-exit${entry.exitCode === 0 && !entry.timedOut ? " is-ok" : ""}`}>
              {entry.timedOut ? "остановлено по таймауту" : `exit ${entry.exitCode}`}
            </div>
          </div>
        ))}
        {running && (
          <div className="terminal-running">
            <LoaderCircle size={12} className="spin" aria-hidden /> выполняем…
          </div>
        )}
        {error && (
          <div className="terminal-error-line">
            <CircleAlert size={12} aria-hidden /> {error}
          </div>
        )}
      </div>

      <form
        className="terminal-input-row"
        onSubmit={(event) => {
          event.preventDefault()
          void run()
        }}
      >
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label="Команда терминала"
          placeholder="введи команду и нажми Enter"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={running || !input.trim()} aria-label="Выполнить команду">
          {running ? <LoaderCircle size={13} className="spin" aria-hidden /> : <Play size={13} aria-hidden />}
        </button>
      </form>

      <div className="terminal-hints" aria-label="Подсказки команд">
        <span>Попробуй:</span>
        {SUGGESTIONS.map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => {
              setInput(command)
              inputRef.current?.focus()
            }}
          >
            {command}
          </button>
        ))}
      </div>
    </section>
  )
}
