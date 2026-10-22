import { Link } from "react-router-dom"

export function NotFound() {
  return (
    <div className="lesson-placeholder">
      <p className="lesson-placeholder__kicker">404</p>
      <h1>Здесь пока ничего нет</h1>
      <p>
        Вернись <Link to="/">к программе</Link>.
      </p>
    </div>
  )
}
