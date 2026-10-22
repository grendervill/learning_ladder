import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { fetchJson } from "../../lib/api"
import { ReportCard } from "./ReportCard"

export interface SessionReport {
  id: string
  started_at: string
  ended_at: string | null
  status: string
  summary_md: string | null
  stats_json: string | null
}

interface SessionContextValue {
  active: boolean
  ending: boolean
  sessionId: string | null
  report: SessionReport | null
  endSession: () => Promise<void>
  dismissReport: () => void
  record: (kind: string, meta?: { lessonId?: string; taskId?: string; meta?: unknown }) => void
}

const SessionContext = createContext<SessionContextValue>({
  active: false,
  ending: false,
  sessionId: null,
  report: null,
  endSession: async () => {},
  dismissReport: () => {},
  record: () => {},
})

const SEEN_KEY = "learninglua.lastReport"

export function SessionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [ending, setEnding] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [report, setReport] = useState<SessionReport | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ lastReport: SessionReport | null }>("/api/session/current")
      .then((current) => {
        if (cancelled) return
        const last = current.lastReport
        if (last && last.id !== window.localStorage.getItem(SEEN_KEY)) setReport(last)
      })
      .catch(() => {})
    fetchJson<{ sessionId: string }>("/api/session/start", { method: "POST", body: "{}" })
      .then((session) => {
        if (!cancelled) {
          setSessionId(session.sessionId)
          setActive(true)
        }
      })
      .catch(() => {})

    const onUnload = () => {
      const blob = new Blob([JSON.stringify({ reason: "beacon" })], { type: "application/json" })
      navigator.sendBeacon("/api/session/end", blob)
    }
    window.addEventListener("beforeunload", onUnload)
    return () => {
      cancelled = true
      window.removeEventListener("beforeunload", onUnload)
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    const timer = window.setInterval(() => {
      void fetchJson("/api/session/heartbeat", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      }).catch(() => {})
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [sessionId])

  const record = useCallback(
    (kind: string, meta: { lessonId?: string; taskId?: string; meta?: unknown } = {}) => {
      void fetchJson("/api/session/activity", {
        method: "POST",
        body: JSON.stringify({ sessionId, kind, ...meta }),
      }).catch(() => {})
    },
    [sessionId],
  )

  const endSession = useCallback(async () => {
    if (ending) return
    setEnding(true)
    try {
      const response = await fetchJson<{ status: string; report?: SessionReport }>("/api/session/end", {
        method: "POST",
        body: JSON.stringify({ wait: true, reason: "manual" }),
      })
      if (response.report?.summary_md) {
        setReport(response.report)
        window.localStorage.setItem(SEEN_KEY, response.report.id)
      }
    } finally {
      setActive(false)
      setSessionId(null)
      setEnding(false)
    }
  }, [ending])

  const dismissReport = useCallback(() => {
    if (report) window.localStorage.setItem(SEEN_KEY, report.id)
    setReport(null)
  }, [report])

  const value = useMemo(
    () => ({ active, ending, sessionId, report, endSession, dismissReport, record }),
    [active, ending, sessionId, report, endSession, dismissReport, record],
  )

  return (
    <SessionContext.Provider value={value}>
      {children}
      {report && <ReportCard report={report} onClose={dismissReport} />}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
