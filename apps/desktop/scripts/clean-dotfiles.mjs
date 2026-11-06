#!/usr/bin/env node

import { readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

async function clean(directory) {
  try {
    for (const file of await readdir(directory)) {
      if (file.startsWith("._")) {
        await unlink(join(directory, file));
      }
    }
  } catch {
    // Directory may not exist.
  }
}

await clean(join(here, "..", "public", "packs"));
await clean(join(here, "..", "dist", "packs"));
