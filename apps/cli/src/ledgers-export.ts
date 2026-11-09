import type { ContentPack, Item } from "@cairn/content";

type CairnEvent = {
  itemId: string;
  learnerId: string;
  timestamp: string;
  correct?: boolean;
  score?: number;
  hintsUsed: number;
  attempts: number;
  confidence?: "guess" | "unsure" | "sure";
  durationMs: number;
  decisionId?: string;
};

export interface CairnExportInput {
  schemaVersion: string;
  exportedAt: string;
  pack: ContentPack;
  events: CairnEvent[];
  decisions?: unknown[];
  model?: unknown;
  policy?: unknown;
}

export interface LedgersBundle {
  skills: { id: string; prereqs: string[] }[];
  items: {
    id: string;
    skills: { skillId: string; weight: number }[];
    authorDifficulty: number;
    kind: "practice" | "worked" | "probe" | "contrast" | "erroneous" | "transfer";
    isTransfer?: boolean;
    isSentinel?: boolean;
    misconceptionTags?: string[];
  }[];
  attempts: {
    learnerId: string;
    itemId: string;
    t: number;
    correct: boolean;
    hintsUsed: number;
    attemptNumber: number;
    confidence?: number;
    latencyMs?: number;
    decisionId?: string;
  }[];
  meta: Record<string, unknown>;
}

function itemKind(item: Item): LedgersBundle["items"][number]["kind"] {
  const tags = new Set(item.tags ?? []);
  if (tags.has("transfer")) return "transfer";
  if (tags.has("contrast")) return "contrast";
  if (tags.has("probe")) return "probe";
  if (item.type === "explain" || item.type === "worked_example") return "worked";
  return "practice";
}

function confidenceValue(
  confidence: CairnEvent["confidence"]
): number | undefined {
  if (confidence === "guess") return 0.33;
  if (confidence === "unsure") return 0.65;
  if (confidence === "sure") return 0.95;
  return undefined;
}

export function toLedgersBundle(input: CairnExportInput): LedgersBundle {
  const skills = input.pack.curriculum.skills.map((skill) => ({
    id: skill.id,
    prereqs: skill.prerequisites ?? [],
  }));
  const items = input.pack.items.map((item) => ({
    id: item.id,
    skills: item.skillIds.map((skillId, index) => ({
      skillId,
      weight: index === 0 ? 1 : 0.5,
    })),
    authorDifficulty: (item.difficulty - 3) / 2,
    kind: itemKind(item),
    isTransfer: item.tags?.includes("transfer") || undefined,
    isSentinel: item.tags?.includes("sentinel") || undefined,
    misconceptionTags: item.misconceptionIds,
  }));
  const attempts = input.events.map((event) => ({
    learnerId: event.learnerId,
    itemId: event.itemId,
    t: Date.parse(event.timestamp),
    correct:
      event.correct ??
      (event.score !== undefined ? event.score >= 0.6 : false),
    hintsUsed: event.hintsUsed,
    attemptNumber: event.attempts,
    confidence: confidenceValue(event.confidence),
    latencyMs: event.durationMs,
    decisionId: event.decisionId,
  }));

  return {
    skills,
    items,
    attempts,
    meta: {
      source: "cairn",
      exportedAt: input.exportedAt,
      schemaVersion: input.schemaVersion,
      packId: input.pack.manifest.id,
      model: input.model,
      policy: input.policy,
      cairnDecisionCount: input.decisions?.length ?? 0,
      note:
        "Cairn decisions are omitted because they lack Ledgers propensities. Prediction is available; policy comparison is not until propensities are logged.",
    },
  };
}
