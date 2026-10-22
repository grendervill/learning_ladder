import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { runLuaTask } from "./runner"
import { resetTaskWorkspace, workspacePath } from "./workspace"

let roots: string[] = []

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "learninglua-lua-"))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
  roots = []
})

describe("runLuaTask", () => {
  it("runs a script and captures stdout", async () => {
    const res = await runLuaTask({
      lessonId: "01",
      taskId: "t",
      files: [{ name: "main.lua", content: 'print("привет")' }],
      entry: "main.lua",
      timeoutMs: 3000,
      workspaceRoot: tempRoot(),
    })
    expect(res.stdout.trim()).toBe("привет")
    expect(res.exitCode).toBe(0)
    expect(res.timedOut).toBe(false)
  })

  it("passes stdin and args", async () => {
    const res = await runLuaTask({
      lessonId: "01",
      taskId: "t2",
      files: [{ name: "main.lua", content: "print(arg[1]); print(io.read())" }],
      entry: "main.lua",
      args: ["раз"],
      stdin: "два\n",
      timeoutMs: 3000,
      workspaceRoot: tempRoot(),
    })
    expect(res.stdout.trim().split("\n")).toEqual(["раз", "два"])
  })

  it("kills an infinite loop", async () => {
    const res = await runLuaTask({
      lessonId: "01",
      taskId: "t3",
      files: [{ name: "main.lua", content: "while true do end" }],
      entry: "main.lua",
      timeoutMs: 500,
      workspaceRoot: tempRoot(),
    })
    expect(res.timedOut).toBe(true)
  })

  it("reports a syntax error before running", async () => {
    const res = await runLuaTask({
      lessonId: "01",
      taskId: "bad",
      files: [{ name: "main.lua", content: "local = 1" }],
      entry: "main.lua",
      timeoutMs: 3000,
      workspaceRoot: tempRoot(),
    })
    expect(res.syntaxError).toBe(true)
    expect(res.exitCode).not.toBe(0)
  })

  it("persists files between runs", async () => {
    const workspaceRoot = tempRoot()
    await runLuaTask({
      lessonId: "06",
      taskId: "diary",
      files: [{ name: "main.lua", content: 'local f=io.open("diary.txt","a"); f:write("x\\n"); f:close()' }],
      entry: "main.lua",
      timeoutMs: 3000,
      workspaceRoot,
    })
    const second = await runLuaTask({
      lessonId: "06",
      taskId: "diary",
      files: [{ name: "main.lua", content: 'local f=io.open("diary.txt","r"); print(f:read("a")); f:close()' }],
      entry: "main.lua",
      timeoutMs: 3000,
      workspaceRoot,
    })
    expect(second.stdout).toContain("x")
  })

  it("resets starter files", async () => {
    const workspaceRoot = tempRoot()
    const dir = workspacePath("06", "reset", workspaceRoot)
    writeFileSync(join(dir, "extra.txt"), "old")
    await resetTaskWorkspace("06", "reset", [{ name: "main.lua", content: "print(1)" }], workspaceRoot)
    expect(existsSync(join(dir, "extra.txt"))).toBe(false)
    expect(existsSync(join(dir, "main.lua"))).toBe(true)
  })
})
