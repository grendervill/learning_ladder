import { rmSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { runTerminalCommand } from "./runner"

const workspaceRoot = resolve(process.cwd(), "data", "workspaces")

afterEach(() => {
  rmSync(resolve(workspaceRoot, "terminal-basics", "t1"), { recursive: true, force: true })
})

describe("runTerminalCommand", () => {
  it("runs a command in the task workspace", async () => {
    const res = await runTerminalCommand({
      lessonId: "terminal-basics",
      taskId: "t1",
      command: "pwd",
    })
    expect(res.stdout.trim()).toContain("data/workspaces/terminal-basics/t1")
    expect(res.exitCode).toBe(0)
  })

  it("persists cd between commands", async () => {
    await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "mkdir sub" })
    const cd = await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "cd sub" })
    expect(cd.cwd.endsWith("/sub")).toBe(true)
    const res = await runTerminalCommand({ lessonId: "terminal-basics", taskId: "t1", command: "pwd" })
    expect(res.stdout.trim().endsWith("/sub")).toBe(true)
  })

  it("supports pipes and redirection", async () => {
    await runTerminalCommand({
      lessonId: "terminal-basics",
      taskId: "t1",
      command: 'echo "a" > f.txt',
    })
    const res = await runTerminalCommand({
      lessonId: "terminal-basics",
      taskId: "t1",
      command: "cat f.txt | wc -l",
    })
    expect(res.stdout.trim()).toBe("1")
  })

  it("times out a hanging command", async () => {
    const res = await runTerminalCommand({
      lessonId: "terminal-basics",
      taskId: "t1",
      command: "sleep 5",
      timeoutMs: 300,
    })
    expect(res.timedOut).toBe(true)
  })

  it("does not allow cd outside the task workspace", async () => {
    const res = await runTerminalCommand({
      lessonId: "terminal-basics",
      taskId: "t1",
      command: "cd ../../..",
    })
    expect(res.exitCode).not.toBe(0)
    expect(res.stderr).toContain("пределы")
  })
})
