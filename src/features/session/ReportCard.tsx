import { CheckCircle2, X } from "lucide-react"
import { Markdown } from "../../lib/markdown"
import type { SessionReport } from "./SessionContext"
import "./ReportCard.css"

export function ReportCard({ report, onClose }: { report: SessionReport; onClose: () => void }) {
  const date = report.ended_at ? new Date(report.ended_at).toLocaleString("ru-RU") : ""
  return (
    <div className="report-overlay" role="presentation">
      <section className="report-card" role="dialog" aria-modal="true" aria-label="Итог занятия">
        <header className="report-card__head">
          <div>
            <span className="report-card__kicker">
              <CheckCircle2 size={13} aria-hidden /> итог занятия
            </span>
            <h2>Что получилось сегодня</h2>
            <p>{date}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть отчёт">
            <X size={16} aria-hidden />
          </button>
        </header>
        <div className="report-card__body">
          <Markdown markdown={report.summary_md ?? "Отчёт пока пуст."} />
        </div>
        <footer className="report-card__foot">
          <button type="button" onClick={onClose}>
            Понятно
          </button>
          <span>Отчёт сохранён в «Успеваемости».</span>
        </footer>
      </section>
    </div>
  )
}
