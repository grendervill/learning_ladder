import { ChartNoAxesColumn } from "lucide-react"
import { Link } from "react-router-dom"
import "./PerformancePlaceholder.css"

export function PerformancePlaceholder() {
  return (
    <div className="performance-placeholder">
      <span className="performance-placeholder__icon">
        <ChartNoAxesColumn size={20} aria-hidden />
      </span>
      <p className="performance-placeholder__kicker">Успеваемость</p>
      <h1>Здесь будет виден весь путь</h1>
      <p>Оценки, разборы и итоги занятий появятся после первых сдач.</p>
      <Link to="/">Вернуться к программе</Link>
    </div>
  )
}
