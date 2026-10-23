import { build } from "esbuild"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const resources = join(root, "src-tauri", "resources")
const vendor = join(root, "src-tauri", "vendor")
const nodeVersion = process.env.NODE_VERSION ?? "26.12.0"

const triple = process.env.TAURI_ENV_TARGET_TRIPLE ?? ""
const platform =
  process.env.DESKTOP_PLATFORM ??
  (triple.includes("windows")
    ? "win32"
    : triple.includes("linux")
      ? "linux"
      : process.platform)
const arch =
  process.env.DESKTOP_ARCH ??
  (triple.startsWith("aarch64") ? "arm64" : triple.startsWith("x86_64") ? "x64" : process.arch)

const nodePlatform =
  platform === "win32" ? `win-${arch}` : `${platform}-${arch}`
const archiveExtension = platform === "win32" ? "zip" : platform === "linux" ? "tar.xz" : "tar.gz"
const binaryName = platform === "win32" ? "node.exe" : "node"
const binaryRelative = platform === "win32" ? binaryName : join("bin", "node")

function fail(message) {
  console.error(`[desktop] ${message}`)
  process.exit(1)
}

async function download(url, target) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(target, bytes)
  console.log(`[desktop] downloaded ${url}`)
}

async function ensureNode() {
  const nodeDir = join(resources, "node")
  const cacheName = `node-v${nodeVersion}-${nodePlatform}`
  const cache = join(vendor, cacheName)
  const cachedBinary = join(cache, binaryRelative)
  if (!existsSync(cachedBinary)) {
    mkdirSync(vendor, { recursive: true })
    const archive = join(vendor, `${cacheName}.${archiveExtension}`)
    if (!existsSync(archive)) {
      await download(
        `https://nodejs.org/dist/v${nodeVersion}/${cacheName}.${archiveExtension}`,
        archive,
      )
    }
    const flags =
      archiveExtension === "zip" ? ["-xf"] : archiveExtension === "tar.xz" ? ["-xJf"] : ["-xzf"]
    const result = spawnSync("tar", [...flags, archive, "-C", vendor], {
      stdio: "inherit",
    })
    if (result.status !== 0) {
      fail(`не удалось распаковать Node: ${result.error ?? result.status}`)
    }
  }
  if (!existsSync(cachedBinary)) fail(`Node не найден после распаковки: ${cachedBinary}`)
  rmSync(nodeDir, { recursive: true, force: true })
  mkdirSync(nodeDir, { recursive: true })
  copyFileSync(cachedBinary, join(nodeDir, binaryName))
  if (platform !== "win32") chmodSync(join(nodeDir, binaryName), 0o755)
}

async function ensureServer() {
  const serverDir = join(resources, "server")
  rmSync(serverDir, { recursive: true, force: true })
  mkdirSync(serverDir, { recursive: true })
  await build({
    entryPoints: [join(root, "server", "desktop.ts")],
    outfile: join(serverDir, "server.cjs"),
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    sourcemap: false,
    external: ["fsevents"],
    logLevel: "info",
  })
}

function ensureWeb() {
  const dist = join(root, "dist")
  if (!existsSync(join(dist, "index.html"))) {
    fail("нет dist/index.html — сначала выполните npm run build")
  }
  const webDir = join(resources, "web")
  rmSync(webDir, { recursive: true, force: true })
  mkdirSync(webDir, { recursive: true })
  cpSync(dist, join(webDir, "dist"), { recursive: true })
}

async function main() {
  console.log(
    `[desktop] target=${platform}-${arch} node=${nodeVersion} (${nodePlatform})`,
  )
  mkdirSync(resources, { recursive: true })
  await ensureServer()
  ensureWeb()
  await ensureNode()
  const size = statSync(join(resources, "node", binaryName)).size
  console.log(`[desktop] resources ready: server.cjs, web/dist, node (${Math.round(size / 1024 / 1024)} MB)`)
}

main().catch((error) => {
  console.error("[desktop] build failed:", error)
  process.exit(1)
})
