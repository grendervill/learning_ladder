export function hasNativeFolderPicker(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export interface ProjectFolderPick {
  path: string | null
  error?: string
}

/**
 * Opens the native folder picker in the Tauri app. In a browser (or if the
 * dialog plugin is unavailable) it returns an error instead of silently
 * pretending the user cancelled.
 */
export async function pickProjectFolder(): Promise<ProjectFolderPick> {
  if (!hasNativeFolderPicker()) {
    return {
      path: null,
      error: "Системный выбор папки доступен только в настольном приложении.",
    }
  }
  try {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Выберите папку проекта",
    })
    if (typeof selected === "string") return { path: selected }
    if (Array.isArray(selected) && typeof selected[0] === "string") {
      return { path: selected[0] }
    }
    return { path: null }
  } catch (error) {
    return {
      path: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
