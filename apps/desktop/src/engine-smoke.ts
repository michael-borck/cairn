import type { ContentPack } from "@cairn/content";
import { createEngine, createMemoryStorage } from "@cairn/engine";

const demoPack = {
  manifest: {
    schemaVersion: "0.1",
    id: "cairn-smoke",
    version: "0.1.0",
    title: "Cairn smoke test",
    description: "A tiny pack that proves the engine runs inside the desktop webview.",
    author: { name: "Cairn" },
    license: "CC0-1.0",
    language: "en",
    audience: "adult-self-learner",
    level: "beginner",
    estimatedMinutes: 1,
    engine: { minVersion: "0.1.0" },
    requires: { ai: false, docker: false, appNetwork: false },
    entries: {
      curriculum: "curriculum.json",
      items: "items.json",
      rubrics: "rubrics.json",
      misconceptions: "misconceptions.json",
      labs: "labs.json",
      policy: "policy.json",
    },
  },
  curriculum: {
    modules: [
      { id: "hello", title: "Hello", order: 1, skillIds: ["hello"] },
    ],
    skills: [
      { id: "hello", title: "Hello", difficulty: 1, prerequisites: [] },
    ],
  },
  items: [
    {
      id: "hello-explain",
      type: "explain",
      skillIds: ["hello"],
      difficulty: 1,
      prompt: "What is Cairn?",
      body: "Cairn is a local-first adaptive learning engine.",
    },
  ],
  rubrics: [],
  misconceptions: [],
  labs: [],
  policy: {
    id: "default-v1",
    targetSuccessMin: 0.75,
    targetSuccessMax: 0.85,
    masteryThreshold: 0.9,
    reviewIntervalsDays: [1, 3, 7, 21, 60],
    hysteresis: { observations: 2, minItemsBetweenChanges: 3 },
    wrongStreak: { similarItem: 1, switchRepresentation: 2, prerequisite: 3 },
    help: {
      startLevelByMastery: { "0.0": 2, "0.4": 1, "0.7": 0 },
      escalateAfterWrong: 2,
      fadeAfterCorrect: 2,
    },
    confidenceSampleRate: 0.2,
  },
} as unknown as ContentPack;

export async function runSmokeTest(): Promise<string> {
  const engine = createEngine({
    pack: demoPack,
    storage: createMemoryStorage(),
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    idFactory: () => "smoke-1",
  });
  const decision = await engine.next({
    learnerId: "smoke",
    session: { availableMinutes: 10, mode: "auto" },
  });
  return `${decision.action}: ${decision.itemId ?? "none"} (${decision.reasonCode})`;
}
