import { ChevronDown } from "lucide-react"
import { Markdown } from "../../lib/markdown"
import type { ProgressSession } from "../../lib/useProgress"

export function ReportList({ sessions }: { sessions: ProgressSession[] }) {
  const reports = sessions.filter((session) => session.summaryMd)
  if (reports.length === 0) {
    return <p className="performance-empty">Итогов занятий пока нет. Заверши занятие — и отчёт появится здесь.</p>
  }
  return (
    <div className="report-list">
      {reports.map((report) => (
        <details className="report-item" key={report.id}>
          <summary>
            <span>
              <b>{new Date(report.startedAt).toLocaleDateString("ru-RU")}</b>
              <small>
                {report.status === "completed_with_warnings" ? "сформирован без ИИ" : "разбор наставника"}
              </small>
            </span>
            <ChevronDown size={14} aria-hidden />
          </summary>
          <div className="report-item__body">
            <Markdown markdown={report.summaryMd ?? ""} />
          </div>
        </details>
      ))}
    </div>
  )
}
