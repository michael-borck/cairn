#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

async function cleanDotFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.name.startsWith("._")) {
      await unlink(path);
      continue;
    }
    if (
      entry.isDirectory() &&
      !["target", "gen", "node_modules"].includes(entry.name)
    ) {
      await cleanDotFiles(path);
    }
  }
}

await cleanDotFiles(join(here, "..", "src-tauri"));

const env = { ...process.env };
if (!env.CARGO_TARGET_DIR) {
  const cache =
    process.platform === "darwin"
      ? join(homedir(), "Library", "Caches", "cairn-target")
      : join(homedir(), ".cache", "cairn-target");
  env.CARGO_TARGET_DIR = cache;
}

const command = process.platform === "win32" ? "tauri.cmd" : "tauri";
const result = spawnSync(command, process.argv.slice(2), {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
