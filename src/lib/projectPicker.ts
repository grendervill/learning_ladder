export function hasNativeFolderPicker(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/**
 * Opens the native folder picker in the Tauri app. In a browser (or if the
 * dialog plugin is unavailable) it returns null and the caller falls back to
 * the manual path input.
 */
export async function pickProjectFolder(): Promise<string | null> {
  if (!hasNativeFolderPicker()) return null
  try {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Выберите папку проекта",
    })
    return typeof selected === "string" ? selected : null
  } catch {
    return null
  }
}
