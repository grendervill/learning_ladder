import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react"
import { useLesson } from "../../lib/useLesson"
import { runtimeLanguage } from "../../lib/courseOptions"
import {
  resetTaskFiles,
  saveTaskFiles,
  useTaskFiles,
  type TaskFilesResponse,
} from "../../lib/useTaskFiles"
import { Markdown } from "../../lib/markdown"
import { CodeEditor } from "./CodeEditor"
import { EditorSettings } from "./EditorSettings"
import { FileTabs } from "./FileTabs"
import { LspProvider, documentUri, useLspClient } from "./LspProvider"
import { LspStatus } from "./LspStatus"
import { MessageCircle } from "lucide-react"
import { MentorDrawer } from "../mentor/MentorDrawer"
import { LovePreview } from "./love/LovePreview"
import { RunPanel } from "./RunPanel"
import { SubmitPanel } from "./SubmitPanel"
import { TerminalPanel } from "./TerminalPanel"
import { StepsPractice } from "./StepsPractice"
import { useEditorSettings } from "./useEditorSettings"
import "./PracticeTab.css"

type SaveState = "idle" | "saving" | "saved" | "error"

type FileItem = { name: string; content: string }

export function PracticeTab(props: {
  lessonId: string
  initialTaskId?: string
  onQuestions?: () => void
}) {
  const { data: lesson } = useLesson(props.lessonId)
  const courseId = lesson?.course?.id
  const lspEnabled = Boolean(courseId && lesson?.course?.settings.lspCommand.trim())
  return (
    <LspProvider courseId={courseId} enabled={lspEnabled}>
      <PracticeTabInner {...props} />
    </LspProvider>
  )
}

function PracticeTabInner({
  lessonId,
  initialTaskId,
  onQuestions,
}: {
  lessonId: string
  initialTaskId?: string
  onQuestions?: () => void
}) {
  const { data: lesson, isLoading, isError, refetch } = useLesson(lessonId)
  const { client: lspClient } = useLspClient()
  const queryClient = useQueryClient()
  const [activeTaskId, setActiveTaskId] = useState(initialTaskId ?? "")
  const [files, setFiles] = useState<FileItem[]>([])
  const [activeFile, setActiveFile] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [addingFile, setAddingFile] = useState(false)
  const [newFileName, setNewFileName] = useState("")
  const [mentorOpen, setMentorOpen] = useState(false)
  const { indent, setIndent } = useEditorSettings()
  const timer = useRef<number | null>(null)
  const loadedTask = useRef<string | null>(null)

  const task = lesson?.tasks.find((item) => item.id === activeTaskId) ?? lesson?.tasks[0]
  const runtime = lesson?.course?.settings.runtime ?? "lua"
  const courseId = lesson?.course?.id ?? "lua"
  const filesQuery = useTaskFiles(lessonId, task?.id)
  const starterNames = new Set(
    (filesQuery.data?.starterFiles ?? task?.files ?? []).map((file) => file.name),
  )
  const solutionFile = task
    ? files.find((file) => file.name === task.entry) ??
      files.find((file) => file.name === "solution.json")
    : undefined
  const stepsContent = solutionFile?.content ?? ""
  const stepsReady =
    task?.kind !== "steps" ||
    (() => {
      try {
        const parsed = JSON.parse(stepsContent)
        return (
          Array.isArray(parsed.steps) &&
          parsed.steps.some(
            (step: any) =>
              String(step?.formula ?? "").trim().length > 0 ||
              String(step?.explanation ?? "").trim().length > 0,
          )
        )
      } catch {
        return false
      }
    })()

  useEffect(() => {
    if (!lesson) return
    if (!lesson.tasks.some((item) => item.id === activeTaskId)) {
      setActiveTaskId(lesson.tasks[0]?.id ?? "")
    }
  }, [lesson, activeTaskId])

  useEffect(() => {
    if (!task || !filesQuery.data) return
    if (loadedTask.current === task.id) return
    loadedTask.current = task.id
    setFiles(filesQuery.data.files)
    const entry =
      filesQuery.data.files.find((file) => file.name === task.entry)?.name ??
      filesQuery.data.files[0]?.name ??
      ""
    setActiveFile(entry)
    setSaveState("idle")
  }, [task, filesQuery.data])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const saveNow = async (taskId: string, nextFiles: FileItem[]) => {
    setSaveState("saving")
    try {
      await saveTaskFiles(lessonId, taskId, nextFiles)
      queryClient.setQueryData<TaskFilesResponse>(
        ["task-files", lessonId, taskId],
        (current) => (current ? { ...current, files: nextFiles } : current),
      )
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }

  const scheduleSave = (taskId: string, nextFiles: FileItem[]) => {
    if (timer.current) window.clearTimeout(timer.current)
    setSaveState("saving")
    timer.current = window.setTimeout(() => void saveNow(taskId, nextFiles), 800)
  }

  const selectTask = (taskId: string) => {
    if (taskId === task?.id) return
    if (timer.current) window.clearTimeout(timer.current)
    loadedTask.current = null
    setActiveTaskId(taskId)
    setFiles([])
    setActiveFile("")
    setSaveState("idle")
    setAddingFile(false)
  }

  const updateFile = (content: string) => {
    if (!task) return
    const next = files.map((file) =>
      file.name === activeFile ? { ...file, content } : file,
    )
    setFiles(next)
    scheduleSave(task.id, next)
  }

  const reset = async () => {
    if (!task) return
    if (timer.current) window.clearTimeout(timer.current)
    setSaveState("saving")
    try {
      const result = await resetTaskFiles(lessonId, task.id)
      setFiles(result.files)
      setActiveFile(result.files[0]?.name ?? "")
      queryClient.setQueryData<TaskFilesResponse>(
        ["task-files", lessonId, task.id],
        (current) => (current ? { ...current, files: result.files } : current),
      )
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }

  const addFile = () => {
    if (!task) return
    const name = newFileName.trim()
    if (!name || files.some((file) => file.name === name)) return
    const next = [...files, { name, content: "" }]
    setFiles(next)
    setActiveFile(name)
    setNewFileName("")
    setAddingFile(false)
    scheduleSave(task.id, next)
  }

  const deleteFile = (name: string) => {
    if (!task || starterNames.has(name)) return
    const next = files.filter((file) => file.name !== name)
    setFiles(next)
    if (activeFile === name) setActiveFile(next[0]?.name ?? "")
    scheduleSave(task.id, next)
  }

  if (isLoading) {
    return (
      <div className="practice-loading" aria-busy="true">
        <LoaderCircle size={17} className="spin" aria-hidden />
        Загружаем практику
      </div>
    )
  }

  if (isError || !lesson) {
    return (
      <div className="practice-empty">
        <CircleAlert size={18} aria-hidden />
        <h2>Не удалось открыть практику</h2>
        <button type="button" onClick={() => refetch()}>
          Повторить
        </button>
      </div>
    )
  }

  if (lesson.tasks.length === 0) {
    return (
      <div className="practice-empty">
        <AlertTriangle size={18} aria-hidden />
        <h2>Заданий пока нет</h2>
        <p>Практика появится вместе со следующим обновлением материала.</p>
      </div>
    )
  }

  return (
    <div className="practice-page">
      <header className="practice-head">
        <span className="section-kicker">
          <Save size={13} aria-hidden /> практика
        </span>
        <h2>{task?.kind === "steps" ? "Покажи ход решения" : "Пиши руками"}</h2>
        <p>
          {task?.kind === "steps"
            ? "Решение сохраняется автоматически. Вводи формулы в LaTeX и объясняй каждый шаг — наставник проверяет именно ход."
            : "Код сохраняется автоматически. Запуск, ошибки и проверка наставником подключаются в следующем слое."}
        </p>
        {lesson.practiceIntro && (
          <div className="practice-intro">
            <Markdown markdown={lesson.practiceIntro} />
          </div>
        )}
      </header>

      <div className="practice-task-tabs" role="tablist" aria-label="Задания урока">
        {lesson.tasks.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === task?.id}
            className={`practice-task-tab${item.id === task?.id ? " is-active" : ""}`}
            onClick={() => selectTask(item.id)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.title}
          </button>
        ))}
      </div>

      {task && (
        <>
          <details className="practice-prompt" open>
            <summary>
              <span>Условие задания</span>
              <span className="practice-prompt__files">
                {task.files.map((file) => file.name).join(" · ")}
              </span>
              <ChevronDown size={14} aria-hidden />
            </summary>
            <div className="practice-prompt__body">
              {task.prompt ? (
                <Markdown markdown={task.prompt} />
              ) : (
                <p>Описание задания находится в файлах.</p>
              )}
            </div>
          </details>

          {task.kind === "steps" ? (
            filesQuery.isLoading ? (
              <div className="practice-loading" aria-busy="true">
                <LoaderCircle size={17} className="spin" aria-hidden />
                Загружаем решение
              </div>
            ) : filesQuery.isError ? (
              <div className="editor-load-error">
                Не удалось загрузить решение.{" "}
                <button type="button" onClick={() => filesQuery.refetch()}>
                  Повторить
                </button>
              </div>
            ) : loadedTask.current !== task.id || files.length === 0 ? (
              <div className="practice-loading" aria-busy="true">
                <LoaderCircle size={17} className="spin" aria-hidden />
                Загружаем решение
              </div>
            ) : (
              <StepsPractice
                key={task.id}
                content={stepsContent}
                onChange={updateFile}
                saveState={saveState}
              />
            )
          ) : task.kind === "terminal" ? (
            <TerminalPanel lessonId={lessonId} taskId={task.id} />
          ) : (
            <>
          <div className="editor-shell">
            <div className="editor-toolbar">
              {filesQuery.isLoading ? (
                <span className="editor-toolbar__loading">Загружаем файлы…</span>
              ) : (
                <FileTabs
                  files={files}
                  activeFile={activeFile}
                  canAdd={task.kind === "project"}
                  onSelect={setActiveFile}
                  onAdd={() => setAddingFile(true)}
                />
              )}
              <div className="editor-toolbar__actions">
                <LspStatus />
                <EditorSettings indent={indent} onChange={setIndent} />
                {task.kind === "project" && activeFile && !starterNames.has(activeFile) && (
                  <button
                    type="button"
                    className="editor-reset"
                    onClick={() => deleteFile(activeFile)}
                    title={`Удалить ${activeFile}`}
                  >
                    <Trash2 size={12} aria-hidden /> удалить
                  </button>
                )}
                <button type="button" className="editor-reset" onClick={reset} title="Вернуть стартовые файлы">
                  <RotateCcw size={12} aria-hidden /> сбросить
                </button>
              </div>
            </div>

            {addingFile && (
              <form
                className="editor-add-file"
                onSubmit={(event) => {
                  event.preventDefault()
                  addFile()
                }}
              >
                <input
                  autoFocus
                  value={newFileName}
                  onChange={(event) => setNewFileName(event.target.value)}
                  placeholder="имя файла, например notes.md"
                  aria-label="Имя нового файла"
                />
                <button type="submit">
                  <Plus size={12} aria-hidden /> добавить
                </button>
                <button type="button" onClick={() => setAddingFile(false)}>
                  отмена
                </button>
              </form>
            )}

            {filesQuery.isError && (
              <div className="editor-load-error">
                Не удалось загрузить файлы. <button type="button" onClick={() => filesQuery.refetch()}>Повторить</button>
              </div>
            )}

            {!filesQuery.isLoading && !filesQuery.isError && (
              <CodeEditor
                key={`${task.id}:${activeFile}`}
                value={files.find((file) => file.name === activeFile)?.content ?? ""}
                onChange={updateFile}
                indent={indent}
                language={runtimeLanguage(runtime)}
                lspClient={lspClient}
                documentUri={documentUri(courseId, lessonId, task.id, activeFile)}
                ariaLabel={`Редактор ${activeFile}`}
              />
            )}

            <div className="editor-statusbar">
              <span className={`editor-save editor-save--${saveState}`}>
                {saveState === "saving" && <LoaderCircle size={11} className="spin" aria-hidden />}
                {saveState === "saved" && <Check size={11} aria-hidden />}
                {saveState === "error" && <CircleAlert size={11} aria-hidden />}
                {saveState === "saving"
                  ? "сохраняем"
                  : saveState === "saved"
                    ? "сохранено"
                    : saveState === "error"
                      ? "не сохранено"
                      : "автосохранение"}
              </span>
              <span className="editor-statusbar__hint">изменения сохраняются автоматически</span>
            </div>
          </div>

          {task.kind === "love" ? (
            <LovePreview files={files} entry={task.entry} />
          ) : (
            <RunPanel
              lessonId={lessonId}
              taskId={task.id}
              files={files}
              kind={task.kind}
              runtime={runtime}
            />
          )}
            </>
          )}

          <SubmitPanel lesson={lesson} extraReady={stepsReady} onQuestions={onQuestions} />
        </>
      )}

      <button type="button" className="mentor-fab" onClick={() => setMentorOpen(true)}>
        <MessageCircle size={14} aria-hidden />
        Спросить наставника
      </button>
      <MentorDrawer
        open={mentorOpen}
        onClose={() => setMentorOpen(false)}
        lessonId={lessonId}
        taskId={task?.id}
      />
    </div>
  )
}
