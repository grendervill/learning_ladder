import { LuaFactory, type LuaEngine } from "wasmoon"

export type LoveColor = [number, number, number, number]

export type LoveCommand =
  | { kind: "clear"; color: LoveColor }
  | { kind: "rect"; mode: string; x: number; y: number; w: number; h: number; color: LoveColor }
  | { kind: "circle"; mode: string; x: number; y: number; r: number; color: LoveColor }
  | { kind: "line"; points: number[]; color: LoveColor }
  | { kind: "print"; text: string; x: number; y: number; color: LoveColor }

const LOVE_SHIM = String.raw`
love = love or {}
love.graphics = love.graphics or {}
love.timer = love.timer or {}

local color = {1, 1, 1, 1}

function love.graphics.setColor(r, g, b, a)
  color = {r or 1, g or 1, b or 1, a or 1}
  __love_setColor(color[1], color[2], color[3], color[4])
end

function love.graphics.clear(r, g, b, a)
  if r then color = {r, g or 1, b or 1, a or 1} end
  __love_clear(color[1], color[2], color[3], color[4])
end

function love.graphics.rectangle(mode, x, y, w, h)
  __love_rect(mode, x, y, w, h, color[1], color[2], color[3], color[4])
end

function love.graphics.circle(mode, x, y, radius)
  __love_circle(mode, x, y, radius, color[1], color[2], color[3], color[4])
end

function love.graphics.line(...)
  local points = {...}
  __love_line(points, color[1], color[2], color[3], color[4])
end

function love.graphics.print(text, x, y)
  __love_print(tostring(text), x or 0, y or 0, color[1], color[2], color[3], color[4])
end

function love.graphics.polygon(mode, points)
  __love_polygon(mode, points, color[1], color[2], color[3], color[4])
end

function love.timer.getDelta()
  return __love_dt
end
`

function colorFrom(r: unknown, g: unknown, b: unknown, a: unknown): LoveColor {
  return [Number(r) || 0, Number(g) || 0, Number(b) || 0, a === undefined ? 1 : Number(a)]
}

function pointsFrom(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number)
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return Object.keys(record)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => Number(record[key]))
  }
  return []
}

export interface LoveRuntime {
  commands: LoveCommand[]
  frame: (dt: number) => Promise<LoveCommand[]>
  keypressed: (key: string) => Promise<void>
  dispose: () => void
}

export async function createLoveRuntime(
  files: Array<{ name: string; content: string }>,
  entry: string,
): Promise<LoveRuntime> {
  const factory = new LuaFactory()
  const lua: LuaEngine = await factory.createEngine()
  const commands: LoveCommand[] = []
  let currentColor: LoveColor = [1, 1, 1, 1]
  let dt = 1 / 60

  lua.global.set("__love_dt", dt)
  lua.global.set("__love_setColor", (r: unknown, g: unknown, b: unknown, a: unknown) => {
    currentColor = colorFrom(r, g, b, a)
  })
  lua.global.set("__love_clear", (r: unknown, g: unknown, b: unknown, a: unknown) => {
    const color = r === undefined ? [0, 0, 0, 1] as LoveColor : colorFrom(r, g, b, a)
    commands.push({ kind: "clear", color })
  })
  lua.global.set("__love_rect", (mode: unknown, x: unknown, y: unknown, w: unknown, h: unknown) => {
    commands.push({
      kind: "rect",
      mode: String(mode),
      x: Number(x) || 0,
      y: Number(y) || 0,
      w: Number(w) || 0,
      h: Number(h) || 0,
      color: [...currentColor] as LoveColor,
    })
  })
  lua.global.set("__love_circle", (mode: unknown, x: unknown, y: unknown, radius: unknown) => {
    commands.push({
      kind: "circle",
      mode: String(mode),
      x: Number(x) || 0,
      y: Number(y) || 0,
      r: Number(radius) || 0,
      color: [...currentColor] as LoveColor,
    })
  })
  lua.global.set("__love_line", (points: unknown) => {
    commands.push({ kind: "line", points: pointsFrom(points), color: [...currentColor] as LoveColor })
  })
  lua.global.set("__love_print", (text: unknown, x: unknown, y: unknown) => {
    commands.push({
      kind: "print",
      text: String(text),
      x: Number(x) || 0,
      y: Number(y) || 0,
      color: [...currentColor] as LoveColor,
    })
  })
  lua.global.set("__love_polygon", (mode: unknown, points: unknown) => {
    const flat = pointsFrom(points)
    if (flat.length >= 4) {
      commands.push({ kind: "line", points: [...flat, flat[0], flat[1]], color: [...currentColor] as LoveColor })
    }
  })

  try {
    await lua.doString(LOVE_SHIM)
    const source = files.find((file) => file.name === entry)?.content ?? files[0]?.content ?? ""
    await lua.doString(source)
    await lua.doString("if love.load then love.load() end")
  } catch (error) {
    lua.global.close()
    throw error
  }

  return {
    commands,
    async frame(nextDt: number) {
      dt = nextDt
      lua.global.set("__love_dt", dt)
      commands.length = 0
      await lua.doString("if love.update then love.update(__love_dt) end")
      await lua.doString("if love.draw then love.draw() end")
      return [...commands]
    },
    async keypressed(key: string) {
      const safe = JSON.stringify(key)
      await lua.doString(`if love.keypressed then love.keypressed(${safe}) end`)
    },
    dispose() {
      lua.global.close()
    },
  }
}

export async function runLovePreview(
  files: Array<{ name: string; content: string }>,
  entry: string,
): Promise<{ commands: LoveCommand[]; errors: string[] }> {
  let runtime: LoveRuntime | null = null
  try {
    runtime = await createLoveRuntime(files, entry)
    const commands = await runtime.frame(1 / 60)
    return { commands, errors: [] }
  } catch (error) {
    return {
      commands: runtime?.commands ?? [],
      errors: [error instanceof Error ? error.message : String(error)],
    }
  } finally {
    runtime?.dispose()
  }
}
