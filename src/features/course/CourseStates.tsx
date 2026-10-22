import { AlertTriangle, RotateCcw } from "lucide-react"
import "./CourseStates.css"

export function PageSkeleton({ label = "Загружаем" }: { label?: string }) {
  return (
    <div className="page-skeleton" aria-label={label} aria-busy="true">
      <span className="page-skeleton__kicker" />
      <span className="page-skeleton__title" />
      <span className="page-skeleton__title page-skeleton__title--short" />
      <span className="page-skeleton__line" />
      <span className="page-skeleton__line page-skeleton__line--short" />
      <div className="page-skeleton__panel" />
    </div>
  )
}

export function AccessError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="access-error">
      <AlertTriangle size={22} aria-hidden />
      <h1>Не удалось открыть программу</h1>
      <p>Проверь, что локальный сервер запущен, и попробуй ещё раз.</p>
      <button type="button" onClick={onRetry}>
        <RotateCcw size={14} aria-hidden /> Повторить
      </button>
    </div>
  )
}
