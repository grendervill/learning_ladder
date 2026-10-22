import { useEffect, useRef, useState } from "react"
import {
  CircleAlert,
  GraduationCap,
  LoaderCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { fetchJson } from "../../lib/api"
import { Markdown } from "../../lib/markdown"
import "./MentorDrawer.css"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
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
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

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
    if (!question || sending) return
    setInput("")
    setError(null)
    setMessages((current) => [...current, { role: "user", content: question }])
    setSending(true)
    try {
      const response = await fetchJson<{ answer: string; conversationId: string }>("/api/mentor/ask", {
        method: "POST",
        body: JSON.stringify({
          question,
          lessonId,
          taskId,
          conversationId: conversationId ?? undefined,
        }),
      })
      setConversationId(response.conversationId)
      setMessages((current) => [...current, { role: "assistant", content: response.answer }])
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "lesson_locked"
          ? "Этот урок ещё закрыт."
          : "Наставник сейчас недоступен. Попробуй ещё раз.",
      )
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="mentor-overlay" role="presentation" onClick={onClose}>
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
          <button type="button" onClick={onClose} aria-label="Закрыть наставника">
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
                <p>{message.content}</p>
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
          <button type="submit" disabled={!input.trim() || sending} aria-label="Отправить">
            {sending ? <LoaderCircle size={13} className="spin" aria-hidden /> : <Send size={13} aria-hidden />}
          </button>
        </form>
      </aside>
    </div>
  )
}
