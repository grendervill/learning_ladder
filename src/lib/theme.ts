import { useEffect, useState } from "react"

export type Theme = "light" | "dark"

export const THEME_STORAGE_KEY = "learninglua.theme"

export function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function initialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  return saved === "dark" || saved === "light" ? saved : systemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((current) => (current === "light" ? "dark" : "light"))
  return { theme, setTheme, toggle }
}
