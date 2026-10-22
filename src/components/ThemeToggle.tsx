import { Moon, Sun } from "lucide-react"
import { useTheme } from "../lib/theme"
import "./ThemeToggle.css"

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme()
  const label = theme === "light" ? "Тёмная тема" : "Светлая тема"
  const Icon = theme === "light" ? Moon : Sun

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? " theme-toggle--compact" : ""}`}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon size={15} strokeWidth={1.75} aria-hidden />
      {!compact && <span>{label}</span>}
    </button>
  )
}
