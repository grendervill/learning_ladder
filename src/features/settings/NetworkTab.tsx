import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  LoaderCircle,
  PlugZap,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react"
import {
  REASONING_LABELS,
  saveSettings,
  testNetwork,
  useProviderModels,
  useSettings,
  type MentorTestResult,
  type ReasoningOption,
} from "../../lib/settings"

const FALLBACK_REASONING: ReasoningOption[] = [
  { id: "off", label: REASONING_LABELS.off },
  { id: "low", label: REASONING_LABELS.low },
  { id: "medium", label: REASONING_LABELS.medium },
  { id: "high", label: REASONING_LABELS.high },
]

function sourceLabel(source: string | undefined): string {
  if (source === "opencode") return "OpenCode"
  if (source === "api") return "API провайдера"
  if (source === "cli") return "OpenCode CLI"
  return "сохранённый список"
}

function catalogHint(
  loading: boolean,
  failed: boolean,
  data: { error?: string; options: ReasoningOption[]; source?: string } | undefined,
  hasKey: boolean,
): string {
  if (loading) return "Обновляем список моделей…"
  if (failed) return "Список моделей недоступен — можно ввести модель вручную."
  if (!data) return "Введите идентификатор модели."
  if (data.error === "provider_key_missing") {
    return "Сохраните API-ключ, чтобы загрузить модели провайдера. Показан сохранённый список."
  }
  if (data.error === "provider_url_missing") {
    return "Укажите адрес сервиса и сохраните настройки, чтобы загрузить модели."
  }
  if (data.error === "provider_models_empty") {
    return "Провайдер не вернул моделей — введите идентификатор вручную."
  }
  if (data.error?.startsWith("opencode_variants_unavailable")) {
    return "OpenCode вернул только список моделей; варианты мышления сейчас недоступны."
  }
  if (data.error?.startsWith("opencode_models_unavailable")) {
    return "OpenCode недоступен — модели не загрузились, можно ввести вручную."
  }
  if (data.error) {
    return `${data.options.length} моделей · ${sourceLabel(data.source)}. Не удалось обновить: ${data.error}`
  }
  if (data.options.length > 0) {
    return `${data.options.length} моделей · ${sourceLabel(data.source)}${hasKey ? "" : " · без ключа"}`
  }
  return hasKey ? "Провайдер не вернул моделей — введите вручную." : "Сохраните ключ или введите модель вручную."
}

export function NetworkTab() {
  const settings = useSettings()
  const queryClient = useQueryClient()
  const [initialized, setInitialized] = useState(false)
  const [provider, setProvider] = useState("opencode")
  const [model, setModel] = useState("")
  const [reasoning, setReasoning] = useState("off")
  const [baseUrl, setBaseUrl] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [keyAction, setKeyAction] = useState<"keep" | "set" | "clear">("keep")
  const [showKey, setShowKey] = useState(false)
  const [manualModel, setManualModel] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const savedTimer = useRef<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<MentorTestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  useEffect(() => {
    if (!settings.data || initialized) return
    setProvider(settings.data.network.provider)
    setModel(settings.data.network.model)
    setReasoning(settings.data.network.reasoning)
    setBaseUrl(settings.data.network.baseUrl)
    setInitialized(true)
  }, [settings.data, initialized])

  const models = useProviderModels(provider)
  const info = settings.data?.catalog.find((entry) => entry.id === provider)
  const providerState = settings.data?.providers[provider]
  const options = models.data?.options ?? []
  const currentOption = options.find((option) => option.id === model)
  const currentInList = Boolean(currentOption)
  const reasoningOptions = useMemo(() => {
    if (currentOption?.reasoning.length) return currentOption.reasoning
    if (provider === "opencode") return [FALLBACK_REASONING[0]]
    return FALLBACK_REASONING
  }, [currentOption, provider])

  useEffect(() => {
    if (!initialized) return
    if (models.isFetching || (!models.data && !models.isError)) return
    if (!reasoningOptions.some((option) => option.id === reasoning)) {
      setReasoning("off")
    }
  }, [reasoningOptions, reasoning, initialized, models.data, models.isError, models.isFetching])

  const dirty =
    Boolean(settings.data) &&
    initialized &&
    (provider !== settings.data!.network.provider ||
      model !== settings.data!.network.model ||
      reasoning !== settings.data!.network.reasoning ||
      baseUrl !== settings.data!.network.baseUrl ||
      keyAction !== "keep")
  const savedRecently = savedAt !== null && !dirty && Date.now() - savedAt < 6000
  const selectValue = manualModel ? "__custom__" : model

  const save = useMutation({
    mutationFn: () =>
      saveSettings({
        network: { provider, model, reasoning, baseUrl },
        providers:
          keyAction === "keep"
            ? undefined
            : { [provider]: { apiKey: keyAction === "clear" ? "" : keyInput.trim() } },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data)
      void queryClient.invalidateQueries({ queryKey: ["settings-checks"] })
      void queryClient.invalidateQueries({ queryKey: ["settings-models"] })
      setKeyInput("")
      setKeyAction("keep")
      setSavedAt(Date.now())
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSavedAt(null), 4000)
    },
  })

  function chooseProvider(id: string) {
    const next = settings.data?.catalog.find((entry) => entry.id === id)
    setProvider(id)
    setModel(next?.defaultModel ?? "")
    setBaseUrl("")
    setKeyInput("")
    setKeyAction("keep")
    setShowKey(false)
    setManualModel(false)
    setTestResult(null)
    setTestError(null)
    setSavedAt(null)
  }

  function pickModel(value: string) {
    if (value === "__custom__") {
      setManualModel(true)
      return
    }
    setManualModel(false)
    if (!value) {
      setModel("")
      resetTest()
      setSavedAt(null)
      return
    }
    setModel(value)
    resetTest()
    setSavedAt(null)
  }

  function resetTest() {
    setTestResult(null)
    setTestError(null)
  }

  async function runTest() {
    setTesting(true)
    resetTest()
    try {
      const result = await testNetwork({
        provider,
        model,
        reasoning,
        apiKey: keyInput.trim() || undefined,
        baseUrl: provider === "custom" ? baseUrl : undefined,
      })
      setTestResult(result)
    } catch (error) {
      setTestError(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(false)
    }
  }

  if (settings.isLoading) {
    return <div className="network-skeleton" />
  }

  if (settings.isError || !settings.data) {
    return (
      <div className="settings-error">
        <p>Не удалось загрузить настройки нейросети.</p>
        <button type="button" className="settings-button settings-button--ghost" onClick={() => void settings.refetch()}>
          Повторить
        </button>
      </div>
    )
  }

  return (
    <div className="network-panel">
      <div className="network-layout">
        <div className="provider-column">
          <h2 className="network-subhead">Провайдер</h2>
          <div className="provider-list" role="radiogroup" aria-label="Провайдер нейросети">
            {settings.data.catalog.map((entry) => {
              const state = settings.data!.providers[entry.id]
              const active = entry.id === provider
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`provider-card${active ? " provider-card--active" : ""}`}
                  key={entry.id}
                  onClick={() => chooseProvider(entry.id)}
                >
                  <span className={`provider-card__lamp${state?.hasKey || !entry.needsKey ? " is-ready" : ""}`} aria-hidden />
                  <span className="provider-card__text">
                    <span className="provider-card__name">{entry.label}</span>
                    <span className="provider-card__state">
                      {!entry.needsKey
                        ? "локально, без ключа"
                        : state?.hasKey
                          ? state.fromEnv
                            ? "ключ из окружения"
                            : "ключ сохранён"
                          : "нужен ключ"}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="network-form">
          <div className="network-form__head">
            <h2>{info?.label ?? provider}</h2>
            <p>{info?.hint ?? "Выберите провайдера и модель, которая будет проверять уроки и отвечать на вопросы."}</p>
          </div>

          <div className="settings-field">
            <span className="settings-field__label">Модель</span>
            <div className="model-row">
              <select
                id="network-model"
                className="settings-input"
                value={selectValue}
                aria-label="Модель"
                onChange={(event) => pickModel(event.target.value)}
              >
                <option value="">Выберите модель</option>
                {options.map((option) => (
                  <option value={option.id} key={option.id}>
                    {option.label || option.id}
                  </option>
                ))}
                {model && !currentInList && (
                  <option value={model}>{model} · сохранённая</option>
                )}
                <option value="__custom__">Другая модель…</option>
              </select>
              <button
                type="button"
                className="model-refresh"
                onClick={() => void models.refetch()}
                disabled={models.isFetching}
                aria-label="Обновить список моделей"
                title="Обновить список моделей"
              >
                {models.isFetching ? (
                  <LoaderCircle size={15} className="spin" aria-hidden />
                ) : (
                  <RefreshCw size={15} aria-hidden />
                )}
              </button>
            </div>
            {manualModel && (
              <input
                className="settings-input model-manual"
                value={model}
                placeholder={info?.defaultModel || "например, gpt-5.6-sol"}
                aria-label="Своя модель"
                onChange={(event) => {
                  setModel(event.target.value)
                  resetTest()
                  setSavedAt(null)
                }}
              />
            )}
            <span className="settings-field__hint">
              {catalogHint(models.isFetching, models.isError, models.data, Boolean(providerState?.hasKey || !info?.needsKey))}
            </span>
          </div>

          <div className="settings-field">
            <span className="settings-field__label">Уровень размышлений</span>
            <div className="reasoning-options" role="radiogroup" aria-label="Уровень размышлений">
              {reasoningOptions.map((option) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={reasoning === option.id}
                  className={`reasoning-option${reasoning === option.id ? " reasoning-option--active" : ""}`}
                  key={option.id}
                  onClick={() => {
                    setReasoning(option.id)
                    resetTest()
                    setSavedAt(null)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="settings-field__hint">
              {reasoningOptions.length <= 1
                ? "У этой модели нет настраиваемых уровней мышления."
                : provider === "opencode"
                  ? "Это варианты выбранной модели OpenCode; «Выкл» — без явного варианта."
                  : "Показываем только уровни, доступные выбранной модели. «Выкл» — самый быстрый режим."}
            </span>
          </div>

          {info?.needsKey && (
            <div className="settings-field">
              <span className="settings-field__label">API-ключ</span>
              <div className="key-row">
                <input
                  className="settings-input"
                  type={showKey ? "text" : "password"}
                  value={keyInput}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={
                    keyAction === "clear"
                      ? "Ключ будет удалён после сохранения"
                      : providerState?.hasKey
                        ? `Сохранён: ${providerState.keyPreview}${providerState.fromEnv ? " (из окружения)" : ""}`
                        : "Вставьте ключ провайдера"
                  }
                  onChange={(event) => {
                    setKeyInput(event.target.value)
                    setKeyAction(event.target.value ? "set" : "keep")
                    resetTest()
                    setSavedAt(null)
                  }}
                />
                <button
                  type="button"
                  className="key-toggle"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? "Скрыть ключ" : "Показать ключ"}
                  title={showKey ? "Скрыть ключ" : "Показать ключ"}
                >
                  {showKey ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                </button>
              </div>
              <span className="settings-field__hint">
                {keyAction === "clear"
                  ? "Ключ будет удалён после сохранения."
                  : providerState?.fromEnv && keyAction === "keep"
                    ? `Ключ берётся из переменной ${info.envVar}. Поле выше переопределит его.`
                    : "Ключ хранится только локально и уходит лишь в запросах к выбранному провайдеру."}
              </span>
              {providerState?.hasKey && keyAction === "keep" && (
                <button
                  type="button"
                  className="key-remove"
                  onClick={() => {
                    setKeyAction("clear")
                    setKeyInput("")
                    resetTest()
                  }}
                >
                  <Trash2 size={13} aria-hidden /> Удалить сохранённый ключ
                </button>
              )}
            </div>
          )}

          {provider === "custom" && (
            <label className="settings-field">
              <span className="settings-field__label">Адрес сервиса</span>
              <input
                className="settings-input"
                value={baseUrl}
                placeholder="http://127.0.0.1:11434/v1"
                onChange={(event) => {
                  setBaseUrl(event.target.value)
                  resetTest()
                  setSavedAt(null)
                }}
              />
              <span className="settings-field__hint">OpenAI-совместимый endpoint без /chat/completions.</span>
            </label>
          )}

          <div className="settings-actions">
            <button
              type="button"
              className="settings-button settings-button--primary"
              disabled={!dirty || save.isPending || !model.trim()}
              onClick={() => save.mutate()}
            >
              {save.isPending ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Save size={14} aria-hidden />}
              {save.isPending ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              type="button"
              className="settings-button settings-button--ghost"
              disabled={testing || !model.trim()}
              onClick={() => void runTest()}
            >
              {testing ? <LoaderCircle size={14} className="spin" aria-hidden /> : <PlugZap size={14} aria-hidden />}
              {testing ? "Проверяем связь…" : "Проверить связь"}
            </button>
            {savedRecently && (
              <span className="settings-saved">
                <CircleCheck size={14} aria-hidden /> Сохранено
              </span>
            )}
            {save.isError && <span className="settings-save-error">Не удалось сохранить: {save.error.message}</span>}
          </div>

          {testResult && (
            <div className={`test-result${testResult.ok ? " test-result--ok" : " test-result--fail"}`}>
              {testResult.ok ? <CircleCheck size={16} aria-hidden /> : <CircleX size={16} aria-hidden />}
              <div>
                <b>
                  {testResult.ok ? "Связь есть" : "Не удалось подключиться"} · {(testResult.ms / 1000).toFixed(1)} с
                </b>
                <span>
                  {testResult.ok
                    ? `Модель ${testResult.model} ответила${testResult.reply ? `: «${testResult.reply}»` : "."}`
                    : testResult.error}
                </span>
              </div>
            </div>
          )}
          {testError && <div className="test-result test-result--fail">{testError}</div>}

          <p className="network-footnote">
            Настройки хранятся локально в <code>{settings.data.settingsPath}</code>. Выбранная модель
            используется наставником для проверки уроков, ответов на вопросы и итогов занятий.
          </p>
        </div>
      </div>
    </div>
  )
}
