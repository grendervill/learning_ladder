import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"
import { settingsForRuntime } from "../../shared/runtimes"
import { runTask } from "./runner"

function available(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0
}

const gcc = available("gcc")
const python = available("python3")
const node = available("node")

describe("generic task runner", () => {
  it("substitutes {dir} and {file}", async () => {
    const result = await runTask({
      files: [{ name: "main.txt", content: "x" }],
      entry: "main.txt",
      command: "printf '%s' {dir}",
      timeoutMs: 3000,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("ladder-run-")
    expect(result.timedOut).toBe(false)
  })

  it.skipIf(!python)("runs Python with quoted args and stdin", async () => {
    const result = await runTask({
      files: [
        {
          name: "main.py",
          content:
            'import sys\nprint("ok")\nprint(sys.stdin.read().strip())\nprint(sys.argv[1])\n',
        },
      ],
      entry: "main.py",
      command: "python3 {file}",
      args: ["a b"],
      stdin: "in\n",
      timeoutMs: 5000,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim().split("\n")).toEqual(["ok", "in", "a b"])
  })

  it.skipIf(!gcc)("returns C compiler diagnostics", async () => {
    const result = await runTask({
      files: [{ name: "main.c", content: "int main( {" }],
      entry: "main.c",
      command: "gcc {file} -o {bin} && {bin}",
      timeoutMs: 10_000,
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/error/i)
  })

  it.skipIf(!gcc)("kills an infinite C program by timeout", async () => {
    const result = await runTask({
      files: [{ name: "main.c", content: "int main(){ while (1) {} }" }],
      entry: "main.c",
      command: "gcc {file} -o {bin} && {bin}",
      timeoutMs: 3000,
    })
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
  })

  it.skipIf(!node)("runs JavaScript", async () => {
    const result = await runTask({
      files: [{ name: "main.js", content: 'console.log("js-ok")' }],
      entry: "main.js",
      command: "node {file}",
      timeoutMs: 5000,
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("js-ok")
  })

  it("exposes per-course runtime presets", () => {
    expect(settingsForRuntime("python")).toMatchObject({
      runtime: "python",
      runCommand: "python3 {file}",
      lspCommand: "pyright-langserver",
      fileExtension: ".py",
    })
    expect(settingsForRuntime("c")).toMatchObject({
      runtime: "c",
      runCommand: "gcc {file} -o {bin} && {bin}",
      lspCommand: "clangd",
    })
    expect(settingsForRuntime("none").runCommand).toBe("")
  })
})
