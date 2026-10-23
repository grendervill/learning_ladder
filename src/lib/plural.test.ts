import { describe, expect, it } from "vitest"
import { plural } from "./plural"

const lesson = ["урок", "урока", "уроков"] as const

describe("plural", () => {
  it("selects Russian forms for counts", () => {
    expect(plural(1, [...lesson])).toBe("урок")
    expect(plural(2, [...lesson])).toBe("урока")
    expect(plural(4, [...lesson])).toBe("урока")
    expect(plural(5, [...lesson])).toBe("уроков")
    expect(plural(11, [...lesson])).toBe("уроков")
    expect(plural(12, [...lesson])).toBe("уроков")
    expect(plural(21, [...lesson])).toBe("урок")
    expect(plural(22, [...lesson])).toBe("урока")
    expect(plural(0, [...lesson])).toBe("уроков")
  })
})
