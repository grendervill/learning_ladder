import { describe, expect, it } from "vitest"
import { pickProjectFolder } from "./projectPicker"

describe("pickProjectFolder", () => {
  it("explains that the native picker is only available in the desktop app", async () => {
    expect(await pickProjectFolder()).toEqual({
      path: null,
      error: "Системный выбор папки доступен только в настольном приложении.",
    })
  })
})
