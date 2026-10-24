import { listOpencodeModels, type OpencodeModelInfo } from "../mentor/client"
import { readSettings, type AppSettings } from "../settings"

const CACHE_MS = 30_000
let cached: { at: number; models: OpencodeModelInfo[] } | null = null

export function directSupportsImages(provider: string): boolean {
  if (provider === "deepseek") return false
  return provider === "openai" || provider === "anthropic" || provider === "google" || provider === "custom"
}

export function supportsImagesFromModels(
  modelRef: string,
  models: Array<Pick<OpencodeModelInfo, "providerID" | "modelID" | "input">>,
): boolean {
  const [providerID, ...rest] = modelRef.split("/")
  const modelID = rest.join("/")
  if (!providerID || !modelID) return false
  const model = models.find(
    (entry) => entry.providerID === providerID && entry.modelID === modelID,
  )
  return Boolean(model?.input?.includes("image"))
}

export async function supportsImages(settings: AppSettings = readSettings()): Promise<boolean> {
  const { provider, model } = settings.network
  if (provider !== "opencode") return directSupportsImages(provider)
  try {
    if (!cached || Date.now() - cached.at > CACHE_MS) {
      cached = { at: Date.now(), models: await listOpencodeModels() }
    }
    return supportsImagesFromModels(model, cached.models)
  } catch {
    return false
  }
}
