import { afterEach, describe, expect, it } from "vitest"
import { hasNativeFolderPicker, pickProjectFolder } from "./projectPicker"

afterEach(() => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
})

describe("project picker fallback", () => {
  it("uses the manual path input in a normal browser", async () => {
    expect(hasNativeFolderPicker()).toBe(false)
    expect(await pickProjectFolder()).toBeNull()
  })

  it("detects the Tauri runtime", () => {
    ;(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    expect(hasNativeFolderPicker()).toBe(true)
  })
})
