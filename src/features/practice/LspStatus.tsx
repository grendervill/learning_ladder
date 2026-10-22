import { CircleAlert, Radio } from "lucide-react"
import { useLspClient } from "./LspProvider"

export function LspStatus() {
  const { status } = useLspClient()
  if (status === "unavailable") {
    return (
      <span className="lsp-status lsp-status--off" title="Языковой сервер недоступен, подсветка и запуск работают">
        <CircleAlert size={10} aria-hidden />
        LSP недоступен
      </span>
    )
  }
  if (status === "connecting") {
    return (
      <span className="lsp-status lsp-status--connecting">
        <Radio size={10} aria-hidden />
        LSP подключается
      </span>
    )
  }
  return (
    <span className="lsp-status lsp-status--on">
      <Radio size={10} aria-hidden />
      LSP live
    </span>
  )
}
