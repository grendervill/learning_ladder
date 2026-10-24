// Normalizes the Debian package name after `tauri build`.
//
// Tauri derives the `Package:` field from productName. The app is called
// «Лестница обучения», so the generated control file contains a Cyrillic
// package name. dpkg only accepts ASCII package names, even though the
// package builds successfully. Rewrite the control member to a stable
// ASCII name and rebuild the .deb, keeping all other metadata and scripts.
//
// Runs automatically via the `posttauri:build` npm hook. No-op outside Linux.

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PACKAGE_NAME = "learning-ladder";

if (process.platform !== "linux") process.exit(0);

const targetRoot = join(process.cwd(), "src-tauri", "target");
if (!existsSync(targetRoot)) process.exit(0);

const debDirs = [];
const defaultDir = join(targetRoot, "release", "bundle", "deb");
if (existsSync(defaultDir)) debDirs.push(defaultDir);

for (const entry of readdirSync(targetRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(targetRoot, entry.name, "release", "bundle", "deb");
  if (existsSync(dir)) debDirs.push(dir);
}

let fixed = 0;

for (const dir of debDirs) {
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".deb")) continue;

    const source = join(dir, file);
    const workDir = mkdtempSync(join(tmpdir(), "learning-ladder-deb-"));
    const controlDir = join(workDir, "DEBIAN");
    const controlFile = join(controlDir, "control");

    try {
      execFileSync("dpkg-deb", ["-R", source, workDir], { stdio: "inherit" });
      chmodSync(controlDir, 0o755);

      const control = readFileSync(controlFile, "utf8");
      const version = /^Version:\s*(.+)$/m.exec(control)?.[1]?.trim();
      const arch = /^Architecture:\s*(.+)$/m.exec(control)?.[1]?.trim();
      if (!version || !arch) {
        throw new Error(`Cannot read Version/Architecture from ${controlFile}`);
      }

      const updated = control.replace(
        /^Package:.*$/m,
        `Package: ${PACKAGE_NAME}`,
      );
      if (updated === control) {
        throw new Error(`No Package field in ${controlFile}`);
      }
      writeFileSync(controlFile, updated);

      const output = join(dir, `${PACKAGE_NAME}_${version}_${arch}.deb`);
      rmSync(output, { force: true });
      execFileSync(
        "dpkg-deb",
        ["--build", "--root-owner-group", workDir, output],
        { stdio: "inherit" },
      );
      if (source !== output) rmSync(source, { force: true });

      console.log(`[deb] ${file} -> ${output}`);
      fixed += 1;
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}

if (fixed === 0) console.log("[deb] no packages to fix");
