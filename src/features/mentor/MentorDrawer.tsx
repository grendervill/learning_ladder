import { useCallback, useEffect, useRef, useState } from "react"
import {
  CircleAlert,
  GraduationCap,
  LoaderCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { AttachmentPicker } from "../../components/AttachmentPicker"
import { deleteAttachment, type UploadedAttachment } from "../../lib/attachments"
import { fetchJson } from "../../lib/api"
import { Markdown } from "../../lib/markdown"
import "./MentorDrawer.css"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  attachments?: UploadedAttachment[]
}

export function MentorDrawer({
  open,
  onClose,
  lessonId,
  taskId,
}: {
  open: boolean
  onClose: () => void
  lessonId?: string
  taskId?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
  const [keepAttachments, setKeepAttachments] = useState(false)
  const [attachmentsBusy, setAttachmentsBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    if (!sending) {
      for (const attachment of attachments) {
        void deleteAttachment(attachment.id)
      }
    }
    onClose()
  }, [attachments, onClose, sending])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (typeof list.scrollTo === "function") {
      list.scrollTo({ top: list.scrollHeight })
    } else {
      list.scrollTop = list.scrollHeight
    }
  }, [messages, sending])

  const send = async () => {
    const question = input.trim()
    const outgoing = attachments
    if ((!question && outgoing.length === 0) || sending || attachmentsBusy) return
    const prompt = question || "Посмотри приложенные файлы и помоги разобраться."
    setInput("")
    setError(null)
    setMessages((current) => [
      ...current,
      { role: "user", content: prompt, ...(outgoing.length ? { attachments: outgoing } : {}) },
    ])
    setSending(true)
    try {
      const response = await fetchJson<{ answer: string; conversationId: string }>("/api/mentor/ask", {
        method: "POST",
        body: JSON.stringify({
          question: prompt,
          lessonId,
          taskId,
          conversationId: conversationId ?? undefined,
          ...(outgoing.length
            ? {
                attachmentIds: outgoing.map((attachment) => attachment.id),
                keepAttachments,
              }
            : {}),
        }),
      })
      setConversationId(response.conversationId)
      setMessages((current) => [...current, { role: "assistant", content: response.answer }])
      setAttachments([])
      setKeepAttachments(false)
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "lesson_locked"
          ? "Этот урок ещё закрыт."
          : cause instanceof Error && cause.message === "model_without_vision"
            ? "Выбранная модель не принимает изображения. Выберите модель с поддержкой vision."
            : "Наставник сейчас недоступен. Попробуй ещё раз.",
      )
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="mentor-overlay" role="presentation" onClick={close}>
      <aside
        className="mentor-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Наставник"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mentor-drawer__head">
          <div className="mentor-drawer__title">
            <span className="mentor-drawer__mark">
              <GraduationCap size={15} aria-hidden />
            </span>
            <div>
              <b>Наставник</b>
              <small>подсказки без готового кода</small>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Закрыть наставника">
            <X size={15} aria-hidden />
          </button>
        </header>

        <div className="mentor-messages" ref={listRef}>
          {messages.length === 0 && (
            <div className="mentor-intro">
              <Sparkles size={15} aria-hidden />
              <p>
                Спроси про код, ошибку или теорию. Я подтолкну к решению, но не напишу его
                за тебя.
              </p>
              <div className="mentor-suggestions">
                {["Почему не работает?", "Что проверить дальше?", "Объясни эту строку"].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion)
                        inputRef.current?.focus()
                      }}
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
          {messages.map((message, index) => (
            <div className={`mentor-message mentor-message--${message.role}`} key={index}>
              {message.role === "assistant" ? (
                <Markdown markdown={message.content} />
              ) : (
                <div>
                  <p>{message.content}</p>
                  {message.attachments && message.attachments.length > 0 && (
                    <ul className="mentor-message__files">
                      {message.attachments.map((attachment) => (
                        <li key={attachment.id}>{attachment.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="mentor-thinking">
              <LoaderCircle size={12} className="spin" aria-hidden /> наставник думает…
            </div>
          )}
          {error && (
            <div className="mentor-error">
              <CircleAlert size={12} aria-hidden /> {error}
            </div>
          )}
        </div>

        <div className="mentor-attachments">
          <AttachmentPicker
            attachments={attachments}
            onChange={setAttachments}
            keep={keepAttachments}
            onKeepChange={setKeepAttachments}
            onBusyChange={setAttachmentsBusy}
            disabled={sending}
            compact
            label="Файлы к вопросу"
            keepLabel="Сохранить в проекте"
          />
        </div>

        <form
          className="mentor-input"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Спроси наставника…"
            aria-label="Сообщение наставнику"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || sending || attachmentsBusy}
            aria-label="Отправить"
          >
            {sending ? <LoaderCircle size={13} className="spin" aria-hidden /> : <Send size={13} aria-hidden />}
          </button>
        </form>
      </aside>
    </div>
  )
}
