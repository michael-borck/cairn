import { invoke } from "@tauri-apps/api/core";
import type { ContentPack } from "@cairn/content";
import {
  ENGINE_MODEL,
  ENGINE_VERSION,
  type Decision,
  type EvidenceEvent,
  type LearnerState,
} from "@cairn/engine";

export interface CairnExport {
  schemaVersion: "0.1";
  exportedAt: string;
  app: {
    name: "Cairn";
    version: string;
    engineVersion: string;
  };
  pack: ContentPack;
  learner: LearnerState;
  events: EvidenceEvent[];
  decisions: Decision[];
  model: typeof ENGINE_MODEL;
  policy: ContentPack["policy"];
}

export function buildCairnExport(input: {
  pack: ContentPack;
  learner: LearnerState;
  events: EvidenceEvent[];
  decisions: Decision[];
}): CairnExport {
  return {
    schemaVersion: "0.1",
    exportedAt: new Date().toISOString(),
    app: {
      name: "Cairn",
      version: "0.1.0",
      engineVersion: ENGINE_VERSION,
    },
    pack: input.pack,
    learner: input.learner,
    events: input.events,
    decisions: input.decisions,
    model: ENGINE_MODEL,
    policy: input.pack.policy,
  };
}

export async function saveCairnExport(data: CairnExport): Promise<boolean> {
  const contents = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const defaultPath = `cairn-export-${data.pack.manifest.id}-${stamp}.json`;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath,
      filters: [{ name: "Cairn export", extensions: ["json"] }],
    });
    if (!path) return false;
    await invoke("write_text_file", { path, contents });
    return true;
  } catch {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = defaultPath;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
