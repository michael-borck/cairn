#!/usr/bin/env node

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const packsRoot = join(repoRoot, "content-packs");
const outDir = join(here, "..", "public", "packs");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function packFromDirectory(dir) {
  const manifest = await readJson(join(dir, "manifest.json"));
  const entries = manifest.entries ?? {};
  const entry = (key, fallback) =>
    typeof entries[key] === "string" && entries[key] ? entries[key] : fallback;
  const [curriculum, items, rubrics, misconceptions, labs, policy] =
    await Promise.all([
      readJson(join(dir, entry("curriculum", "curriculum.json"))),
      readJson(join(dir, entry("items", "items.json"))),
      readJson(join(dir, entry("rubrics", "rubrics.json"))),
      readJson(join(dir, entry("misconceptions", "misconceptions.json"))),
      readJson(join(dir, entry("labs", "labs.json"))),
      readJson(join(dir, entry("policy", "policy.json"))),
    ]);
  return { manifest, curriculum, items, rubrics, misconceptions, labs, policy };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const entries = new Map();

  let children = [];
  try {
    children = await readdir(packsRoot, { withFileTypes: true });
  } catch {
    console.warn("No content-packs directory found.");
  }

  for (const child of children) {
    if (child.name.startsWith(".") || child.name.startsWith("_.")) continue;
    if (child.name === "example") continue;
    const path = join(packsRoot, child.name);
    try {
      const pack = child.isDirectory()
        ? await packFromDirectory(path)
        : child.name.endsWith("pack.json")
          ? await readJson(path)
          : null;
      if (!pack?.manifest?.id) continue;
      const manifest = pack.manifest;
      const fileName = `${manifest.id}.json`;
      await writeFile(join(outDir, fileName), JSON.stringify(pack, null, 2) + "\n");
      entries.set(manifest.id, {
        id: manifest.id,
        title: manifest.title,
        version: manifest.version,
        description: manifest.description,
        file: fileName,
      });
      console.log(`Bundled ${manifest.title} -> public/packs/${fileName}`);
    } catch (error) {
      console.warn(`Skipped ${child.name}: ${error.message}`);
    }
  }

  const packs = [...entries.values()].sort((a, b) => a.title.localeCompare(b.title));
  await writeFile(
    join(outDir, "index.json"),
    JSON.stringify({ packs }, null, 2) + "\n"
  );
  for (const file of await readdir(outDir)) {
    if (file.startsWith("._")) await unlink(join(outDir, file));
  }
  console.log(`Bundled ${packs.length} pack(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
