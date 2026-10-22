import { useSearchParams } from "react-router-dom"
import { Cpu, GraduationCap, Settings2, Stethoscope } from "lucide-react"
import { ChecksTab } from "./ChecksTab"
import { MentorTab } from "./MentorTab"
import { NetworkTab } from "./NetworkTab"
import "./SettingsPage.css"

const TABS = [
  { id: "checks", label: "Проверки", icon: Stethoscope },
  { id: "mentor", label: "Наставник", icon: GraduationCap },
  { id: "network", label: "Нейросеть", icon: Cpu },
] as const

type TabId = (typeof TABS)[number]["id"]

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  const tab: TabId = TABS.some((entry) => entry.id === requested) ? (requested as TabId) : "checks"

  function select(id: TabId) {
    setParams(id === "checks" ? {} : { tab: id }, { replace: true })
  }

  return (
    <div className="settings-page">
      <header className="settings-head">
        <span className="section-kicker">
          <Settings2 size={13} aria-hidden /> кабинет
        </span>
        <h1>Настройки</h1>
        <p>Проверки инструментов, промпт наставника и подключение нейросети. Всё хранится локально.</p>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Разделы настроек">
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
        {tab === "mentor" && <MentorTab />}
        {tab === "network" && <NetworkTab />}
      </section>
    </div>
  )
}
