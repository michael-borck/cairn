#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

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
