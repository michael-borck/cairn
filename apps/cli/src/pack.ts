import { readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${path}: ${reason}`);
  }
}

function entryName(entries: Record<string, unknown>, key: string, fallback: string): string {
  const value = entries[key];
  return typeof value === "string" && value ? value : fallback;
}

export async function loadPack(path: string): Promise<unknown> {
  const absolute = resolve(path);
  const info = await stat(absolute).catch(() => null);
  if (!info) throw new Error(`No such pack: ${absolute}`);

  if (info.isFile()) {
    return readJson(absolute);
  }

  if (!info.isDirectory()) {
    throw new Error(`Pack path is neither a file nor a directory: ${absolute}`);
  }

  const manifest = await readJson(join(absolute, "manifest.json"));
  if (!manifest || typeof manifest !== "object") {
    throw new Error(`${absolute}/manifest.json must contain an object`);
  }
  const entries =
    "entries" in manifest && manifest.entries && typeof manifest.entries === "object"
      ? (manifest.entries as Record<string, unknown>)
      : {};

  const readEntry = (key: string, fallback: string): Promise<unknown> =>
    readJson(join(absolute, entryName(entries, key, fallback)));

  const [curriculum, items, rubrics, misconceptions, labs, policy] =
    await Promise.all([
      readEntry("curriculum", "curriculum.json"),
      readEntry("items", "items.json"),
      readEntry("rubrics", "rubrics.json"),
      readEntry("misconceptions", "misconceptions.json"),
      readEntry("labs", "labs.json"),
      readEntry("policy", "policy.json"),
    ]);

  return {
    manifest,
    curriculum,
    items,
    rubrics,
    misconceptions,
    labs,
    policy,
  };
}

export function packLabel(path: string): string {
  return basename(resolve(path));
}
