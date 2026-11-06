import { validatePack, type ContentPack } from "@cairn/content";

export type PackSource = "builtin" | "local";

export interface PackEntry {
  id: string;
  title: string;
  version: string;
  description: string;
  source: PackSource;
  file?: string;
}

const IMPORTED_PACK_KEY = "cairn.imported-pack.v1";

function requirePack(input: unknown): ContentPack {
  const result = validatePack(input);
  if (!result.ok || !result.pack) {
    const detail = result.errors.slice(0, 8).join("\n");
    throw new Error(detail || "The pack is not valid.");
  }
  return result.pack;
}

export function entryForPack(
  pack: ContentPack,
  source: PackSource = "local"
): PackEntry {
  return {
    id: pack.manifest.id,
    title: pack.manifest.title,
    version: pack.manifest.version,
    description: pack.manifest.description,
    source,
  };
}

export async function loadBuiltinPacks(): Promise<PackEntry[]> {
  try {
    const response = await fetch("/packs/index.json");
    if (!response.ok) return [];
    const data = (await response.json()) as {
      packs?: Omit<PackEntry, "source">[];
    };
    if (!Array.isArray(data.packs)) return [];
    return data.packs.map((entry) => ({ ...entry, source: "builtin" }));
  } catch {
    return [];
  }
}

export function loadImportedPack(): ContentPack | null {
  try {
    const raw = localStorage.getItem(IMPORTED_PACK_KEY);
    if (!raw) return null;
    return requirePack(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveImportedPack(pack: ContentPack): void {
  localStorage.setItem(IMPORTED_PACK_KEY, JSON.stringify(pack));
}

export async function readPackFile(file: File): Promise<ContentPack> {
  const text = await file.text();
  return requirePack(JSON.parse(text));
}

export async function loadPack(entry: PackEntry): Promise<ContentPack> {
  if (entry.source === "local") {
    const pack = loadImportedPack();
    if (!pack) throw new Error("The imported pack is no longer stored.");
    return pack;
  }
  const file = entry.file ?? `${entry.id}.json`;
  const response = await fetch(`/packs/${file}`);
  if (!response.ok) throw new Error(`Could not load ${entry.title}.`);
  return requirePack(await response.json());
}
