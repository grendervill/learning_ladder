import { Sparkles, WandSparkles } from "lucide-react"
import { useCourseWizard } from "../courses/CourseWizardProvider"

export function CreateTab() {
  const wizard = useCourseWizard()
  return (
    <div className="create-panel">
      <span className="create-panel__icon" aria-hidden>
        <WandSparkles size={24} strokeWidth={1.6} />
      </span>
      <h2>Создать курс</h2>
      <p>
        Опишите, чему хотите научиться. Конструктор уточнит запрос, предложит варианты
        и соберёт программу, карточку и наставника курса.
      </p>
      <button
        type="button"
        className="settings-button settings-button--primary"
        onClick={wizard.open}
      >
        <Sparkles size={15} aria-hidden /> Открыть мастер
      </button>
      <span className="create-panel__note">
        Мастер использует выбранную на вкладке «Нейросеть» модель и промпт из «Конструктора».
      </span>
    </div>
  )
}
