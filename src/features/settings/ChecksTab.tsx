import { CircleCheck, CircleX, RefreshCw, TriangleAlert } from "lucide-react"
import { useChecks, type CheckResult } from "../../lib/settings"

const STATUS_LABEL: Record<CheckResult["status"], string> = {
  ok: "ок",
  warn: "внимание",
  fail: "ошибка",
}

function StatusIcon({ status }: { status: CheckResult["status"] }) {
  if (status === "ok") return <CircleCheck size={16} aria-hidden />
  if (status === "warn") return <TriangleAlert size={16} aria-hidden />
  return <CircleX size={16} aria-hidden />
}

function groupChecks(checks: CheckResult[]): Array<{ group: string; items: CheckResult[] }> {
  const groups: Array<{ group: string; items: CheckResult[] }> = []
  for (const check of checks) {
    const existing = groups.find((entry) => entry.group === check.group)
    if (existing) {
      existing.items.push(check)
    } else {
      groups.push({ group: check.group, items: [check] })
    }
  }
  return groups
}

export function ChecksTab() {
  const checks = useChecks()
  const data = checks.data

  return (
    <div className="checks-panel">
      <div className="checks-summary">
        <div>
          {data ? (
            data.summary.fail === 0 && data.summary.warn === 0 ? (
              <p className="checks-summary__line">
                <CircleCheck size={17} aria-hidden /> Все проверки пройдены
              </p>
            ) : (
              <p className="checks-summary__line checks-summary__line--warn">
                <TriangleAlert size={17} aria-hidden />
                {data.summary.fail > 0
                  ? `${data.summary.fail} с ошибкой, ${data.summary.warn} с замечаниями`
                  : `${data.summary.warn} с замечаниями`}
              </p>
            )
          ) : (
            <p className="checks-summary__line">Проверяем кабинет…</p>
          )}
          <span className="checks-summary__meta">
            {data
              ? `${data.summary.ok} из ${data.checks.length} пунктов в порядке · ${new Date(data.generatedAt).toLocaleTimeString("ru-RU")}`
              : "Lua, сервер языка, OpenCode, база и материалы"}
          </span>
        </div>
        <button
          type="button"
          className="settings-button settings-button--ghost"
          onClick={() => void checks.refetch()}
          disabled={checks.isFetching}
        >
          <RefreshCw size={14} className={checks.isFetching ? "spin" : undefined} aria-hidden />
          {checks.isFetching ? "Проверяем…" : "Проверить снова"}
        </button>
      </div>

      {checks.isError && (
        <div className="settings-error">
          <p>Не удалось выполнить проверки.</p>
          <button type="button" className="settings-button settings-button--ghost" onClick={() => void checks.refetch()}>
            Повторить
          </button>
        </div>
      )}

      {!data && !checks.isError && (
        <div className="check-groups" aria-label="Идёт проверка">
          {[0, 1, 2].map((index) => (
            <div className="check-skeleton" key={index} />
          ))}
        </div>
      )}

      {data && (
        <div className="check-groups">
          {groupChecks(data.checks).map((group) => (
            <section className="check-group" key={group.group}>
              <h2 className="check-group__title">{group.group}</h2>
              {group.items.map((check) => (
                <div className={`check-row check-row--${check.status}`} key={check.id}>
                  <span className="check-row__lamp" aria-hidden>
                    <StatusIcon status={check.status} />
                  </span>
                  <div className="check-row__text">
                    <span className="check-row__label">{check.label}</span>
                    <span className="check-row__detail">{check.detail}</span>
                    {check.hint && <span className="check-row__hint">{check.hint}</span>}
                  </div>
                  <span className="check-row__status">{STATUS_LABEL[check.status]}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
