import { useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { Cpu, FolderOpen, Plus, Settings2, Stethoscope, WandSparkles } from "lucide-react"
import { ChecksTab } from "./ChecksTab"
import { ConstructorTab } from "./ConstructorTab"
import { CreateTab } from "./CreateTab"
import { NetworkTab } from "./NetworkTab"
import { ProjectTab } from "./ProjectTab"
import "./SettingsPage.css"

const TABS = [
  { id: "checks", label: "Проверки", icon: Stethoscope },
  { id: "network", label: "Нейросеть", icon: Cpu },
  { id: "create", label: "Создать курс", icon: Plus },
  { id: "constructor", label: "Конструктор", icon: WandSparkles },
  { id: "project", label: "Папка проекта", icon: FolderOpen },
] as const

type TabId = (typeof TABS)[number]["id"]

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tabsRef = useRef<HTMLDivElement>(null)
  const requested = params.get("tab")
  const tab: TabId = TABS.some((entry) => entry.id === requested) ? (requested as TabId) : "checks"

  function select(id: TabId) {
    setParams({ tab: id }, { replace: true })
    requestAnimationFrame(() => {
      const tabs = tabsRef.current
      if (!tabs) return
      const top = tabs.getBoundingClientRect().top
      if (top >= 0) return
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      window.scrollTo({
        top: window.scrollY + top - 12,
        behavior: reduceMotion ? "auto" : "smooth",
      })
    })
  }

  return (
    <div className="settings-page">
      <header className="settings-head">
        <span className="section-kicker">
          <Settings2 size={13} aria-hidden /> кабинет
        </span>
        <h1>Настройки</h1>
        <p>
          Проверки инструментов, нейросеть, конструктор курсов и папка проекта.
          Наставник и практика настраиваются внутри каждого курса.
        </p>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Разделы настроек" ref={tabsRef}>
        {TABS.map((entry) => {
          const Icon = entry.icon
          const active = tab === entry.id
          return (
            <button
              type="button"
              role="tab"
              id={`settings-tab-${entry.id}`}
              aria-selected={active}
              aria-controls={`settings-panel-${entry.id}`}
              tabIndex={active ? 0 : -1}
              className={`settings-tab${active ? " settings-tab--active" : ""}`}
              key={entry.id}
              onClick={() => select(entry.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
                event.preventDefault()
                const index = TABS.findIndex((item) => item.id === tab)
                const next = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]
                select(next.id)
                document.getElementById(`settings-tab-${next.id}`)?.focus()
              }}
            >
              <Icon size={15} aria-hidden />
              {entry.label}
            </button>
          )
        })}
      </div>

      <section
        className="settings-panel"
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
        key={tab}
      >
        {tab === "checks" && <ChecksTab />}
        {tab === "network" && <NetworkTab />}
        {tab === "create" && <CreateTab />}
        {tab === "constructor" && <ConstructorTab />}
        {tab === "project" && <ProjectTab />}
      </section>
    </div>
  )
}
