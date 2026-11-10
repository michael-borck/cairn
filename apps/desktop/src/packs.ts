import { invoke } from "@tauri-apps/api/core";
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

export interface CatalogPack {
  id: string;
  title: string;
  version: string;
  description: string;
  author: string;
  licence: string;
  level: string;
  audience: string;
  estimatedMinutes: number;
  skills: number;
  items: number;
  labs: number;
  url: string;
  sha256: string;
  trust: string;
  tags?: string[];
  updatedAt?: string;
}

export interface Catalog {
  format: "cairn-catalog";
  version: number;
  generated: string;
  packs: CatalogPack[];
}

export const DEFAULT_CATALOG_URL =
  "https://michael-borck.github.io/cairn-packs/catalog/index.json";

const INSTALLED_PACKS_KEY = "cairn.installed-packs.v1";
const LEGACY_IMPORTED_PACK_KEY = "cairn.imported-pack.v1";

interface InstalledPack {
  pack: ContentPack;
  installedAt: string;
  sourceUrl?: string;
}

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

function readInstalledPacks(): Record<string, InstalledPack> {
  try {
    const raw = localStorage.getItem(INSTALLED_PACKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, InstalledPack>;
      const result: Record<string, InstalledPack> = {};
      for (const [id, record] of Object.entries(parsed ?? {})) {
        try {
          result[id] = {
            ...record,
            pack: requirePack(record.pack),
          };
        } catch {
          // Ignore a corrupt record and keep the rest of the library usable.
        }
      }
      return result;
    }

    const legacy = localStorage.getItem(LEGACY_IMPORTED_PACK_KEY);
    if (legacy) {
      const pack = requirePack(JSON.parse(legacy));
      return {
        [pack.manifest.id]: {
          pack,
          installedAt: new Date().toISOString(),
        },
      };
    }
  } catch {
    // Fall through to an empty library.
  }
  return {};
}

export function loadInstalledPacks(): ContentPack[] {
  return Object.values(readInstalledPacks()).map((record) => record.pack);
}

export function loadImportedPack(): ContentPack | null {
  return loadInstalledPacks()[0] ?? null;
}

export function saveImportedPack(pack: ContentPack, sourceUrl?: string): void {
  const installed = readInstalledPacks();
  installed[pack.manifest.id] = {
    pack,
    installedAt: new Date().toISOString(),
    sourceUrl,
  };
  localStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(installed));
}

export function removeInstalledPack(packId: string): void {
  const installed = readInstalledPacks();
  delete installed[packId];
  localStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify(installed));
}

export async function readPackFile(file: File): Promise<ContentPack> {
  const text = await file.text();
  return requirePack(JSON.parse(text));
}

export async function choosePackDirectory(): Promise<ContentPack | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open a Cairn pack folder",
  });
  if (typeof selected !== "string") return null;
  const input = await invoke<unknown>("read_pack_dir", { path: selected });
  return requirePack(input);
}

export async function loadPack(entry: PackEntry): Promise<ContentPack> {
  if (entry.source === "local") {
    const pack = loadInstalledPacks().find(
      (candidate) => candidate.manifest.id === entry.id
    );
    if (!pack) throw new Error("The installed pack is no longer stored.");
    return pack;
  }
  const file = entry.file ?? `${entry.id}.json`;
  const response = await fetch(`/packs/${file}`);
  if (!response.ok) throw new Error(`Could not load ${entry.title}.`);
  return requirePack(await response.json());
}

export async function loadCatalog(
  url = DEFAULT_CATALOG_URL
): Promise<{ url: string; catalog: Catalog }> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status}).`);
  }
  const data = (await response.json()) as Partial<Catalog>;
  if (data.format !== "cairn-catalog" || !Array.isArray(data.packs)) {
    throw new Error("This is not a Cairn pack catalog.");
  }
  return { url, catalog: data as Catalog };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

interface ZipLike {
  file(name: string): { async(type: "text"): Promise<string> } | null;
}

async function readZipJson(zip: ZipLike, name: string): Promise<unknown> {
  const file = zip.file(name);
  if (!file) throw new Error(`The pack is missing ${name}.`);
  return JSON.parse(await file.async("text"));
}

export async function installCatalogPack(
  entry: CatalogPack,
  catalogUrl = DEFAULT_CATALOG_URL
): Promise<ContentPack> {
  const artifactUrl = new URL(entry.url, catalogUrl).toString();
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}).`);
  }
  const buffer = await response.arrayBuffer();
  const hash = await sha256Hex(buffer);
  if (hash !== entry.sha256) {
    throw new Error("The pack hash does not match the catalog.");
  }

  const { default: JSZip } = await import("jszip");
  const zip = (await JSZip.loadAsync(buffer)) as unknown as ZipLike;
  const pack = {
    manifest: await readZipJson(zip, "manifest.json"),
    curriculum: await readZipJson(zip, "curriculum.json"),
    items: await readZipJson(zip, "items.json"),
    rubrics: await readZipJson(zip, "rubrics.json"),
    misconceptions: await readZipJson(zip, "misconceptions.json"),
    labs: await readZipJson(zip, "labs.json"),
    policy: await readZipJson(zip, "policy.json"),
  };
  const validated = requirePack(pack);
  if (
    validated.manifest.id !== entry.id ||
    validated.manifest.version !== entry.version
  ) {
    throw new Error("The pack manifest does not match the catalog entry.");
  }
  saveImportedPack(validated, artifactUrl);
  return validated;
}
