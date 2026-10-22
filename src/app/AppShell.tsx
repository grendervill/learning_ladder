import { useCallback, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Menu, MoonStar } from "lucide-react"
import { Sidebar } from "../components/Sidebar"
import { ThemeToggle } from "../components/ThemeToggle"
import { SessionProvider } from "../features/session/SessionContext"
import "./AppShell.css"

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const location = useLocation()

  return (
    <SessionProvider>
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <div className="app-main">
          <header className="mobile-bar">
            <button
              type="button"
              className="mobile-bar__menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Открыть программу"
            >
              <Menu size={19} />
            </button>
            <div className="mobile-bar__brand">
              <MoonStar size={14} aria-hidden />
              <span>Лестница Lua</span>
            </div>
            <ThemeToggle compact />
          </header>
          <main className="app-content" key={location.pathname}>
            <Outlet />
          </main>
        </div>
      </div>
    </SessionProvider>
  )
}
