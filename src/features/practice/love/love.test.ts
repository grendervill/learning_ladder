// @vitest-environment node
import { describe, expect, it } from "vitest"
import { runLovePreview } from "./love-runtime"

describe("runLovePreview", () => {
  it("records love.graphics calls", async () => {
    const result = await runLovePreview(
      [
        {
          name: "main.lua",
          content:
            'function love.draw()\n  love.graphics.setColor(1, 0, 0)\n  love.graphics.rectangle("fill", 10, 20, 30, 40)\nend',
        },
      ],
      "main.lua",
    )
    expect(result.errors).toEqual([])
    expect(result.commands).toContainEqual(
      expect.objectContaining({ kind: "rect", mode: "fill", x: 10, y: 20, w: 30, h: 40 }),
    )
  })

  it("returns lua errors", async () => {
    const result = await runLovePreview(
      [{ name: "main.lua", content: 'function love.draw() error("boom") end' }],
      "main.lua",
    )
    expect(result.errors.join(" ")).toContain("boom")
  })

  it("runs update before draw", async () => {
    const result = await runLovePreview(
      [
        {
          name: "main.lua",
          content:
            "local x = 0\nfunction love.update(dt) x = x + dt end\nfunction love.draw() love.graphics.circle('fill', x, 10, 5) end",
        },
      ],
      "main.lua",
    )
    expect(result.errors).toEqual([])
    const circle = result.commands.find((command) => command.kind === "circle")
    expect(circle).toBeTruthy()
    expect((circle as any).x).toBeGreaterThan(0)
  })
})
