import { useRef, useState } from "react"
import { AlertCircle, FileText, Image, LoaderCircle, Paperclip, X } from "lucide-react"
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_FILES,
  deleteAttachment,
  formatFileSize,
  prepareImage,
  uploadAttachments,
  validateAttachmentFile,
  type UploadedAttachment,
} from "../lib/attachments"
import "./AttachmentPicker.css"

export interface AttachmentPickerProps {
  attachments: UploadedAttachment[]
  onChange: (attachments: UploadedAttachment[]) => void
  keep: boolean
  onKeepChange: (keep: boolean) => void
  disabled?: boolean
  compact?: boolean
  label?: string
  keepLabel?: string
  onBusyChange?: (busy: boolean) => void
}

export function AttachmentPicker({
  attachments,
  onChange,
  keep,
  onKeepChange,
  disabled = false,
  compact = false,
  label = "Материалы",
  keepLabel = "Сохранить в папке проекта",
  onBusyChange,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = disabled || uploading

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files)
    if (incoming.length === 0 || busy) return
    if (attachments.length + incoming.length > MAX_ATTACHMENT_FILES) {
      setError(`Можно приложить не больше ${MAX_ATTACHMENT_FILES} файлов.`)
      return
    }
    for (const file of incoming) {
      const problem = validateAttachmentFile(file, attachments.length)
      if (problem) {
        setError(problem)
        return
      }
    }
    setError(null)
    setUploading(true)
    onBusyChange?.(true)
    try {
      const prepared = await Promise.all(incoming.map((file) => prepareImage(file)))
      for (const file of prepared) {
        if (file.size > 25 * 1024 * 1024) {
          setError(`Файл «${file.name}» больше 25 МБ.`)
          return
        }
      }
      const uploaded = await uploadAttachments(prepared)
      onChange([...attachments, ...uploaded])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setUploading(false)
      onBusyChange?.(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function remove(attachment: UploadedAttachment) {
    onChange(attachments.filter((item) => item.id !== attachment.id))
    void deleteAttachment(attachment.id).catch(() => {})
  }

  return (
    <section
      className={`attachment-picker${compact ? " attachment-picker--compact" : ""}${
        dragging ? " is-dragging" : ""
      }`}
      aria-label={label}
      onDragOver={(event) => {
        event.preventDefault()
        if (!busy) setDragging(true)
      }}
      onDragLeave={(event) => {
        if (event.target === event.currentTarget) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        void addFiles(event.dataTransfer.files)
      }}
    >
      <div className="attachment-picker__head">
        <div className="attachment-picker__copy">
          <span className="attachment-picker__title">
            <Paperclip size={14} aria-hidden /> {label}
          </span>
          {!compact && (
            <span className="attachment-picker__hint">
              PDF, DOCX, PNG, JPEG, WebP, TXT, MD, CSV, JSON · до 25 МБ
            </span>
          )}
        </div>
        <button
          type="button"
          className="attachment-picker__add"
          onClick={() => inputRef.current?.click()}
          disabled={busy || attachments.length >= MAX_ATTACHMENT_FILES}
        >
          {uploading ? (
            <LoaderCircle size={14} className="spin" aria-hidden />
          ) : (
            <Paperclip size={14} aria-hidden />
          )}
          {uploading ? "Загружаем…" : "Прикрепить файлы"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          hidden
          aria-label="Выбрать файлы"
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files)
          }}
        />
      </div>

      {attachments.length > 0 && (
        <ul className="attachment-picker__list">
          {attachments.map((attachment) => {
            const Icon = attachment.kind === "image" ? Image : FileText
            return (
              <li key={attachment.id}>
                <span className="attachment-picker__file-icon" aria-hidden>
                  <Icon size={13} />
                </span>
                <span className="attachment-picker__file-name" title={attachment.name}>
                  {attachment.name}
                </span>
                <span className="attachment-picker__file-size">
                  {formatFileSize(attachment.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(attachment)}
                  disabled={busy}
                  aria-label={`Удалить ${attachment.name}`}
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <label className="attachment-picker__keep">
        <input
          type="checkbox"
          checked={keep}
          onChange={(event) => onKeepChange(event.target.checked)}
          disabled={busy}
        />
        <span>
          <b>{keepLabel}</b>
          <small>
            {keep
              ? "Файлы останутся в папке проекта."
              : "Файлы удалятся после использования."}
          </small>
        </span>
      </label>

      {error && (
        <p className="attachment-picker__error" role="alert">
          <AlertCircle size={13} aria-hidden /> {error}
        </p>
      )}
    </section>
  )
}
