import { invoke } from "@tauri-apps/api/core";
import { validatePack, type ContentPack } from "@cairn/content";

export const STARTER_PACK = {
  manifest: {
    schemaVersion: "0.1",
    id: "my-first-pack",
    version: "0.1.0",
    title: "My First Pack",
    description: "A small pack to edit and grow.",
    author: { name: "You" },
    license: "CC-BY-4.0",
    language: "en",
    audience: "adult-self-learner",
    level: "beginner",
    estimatedMinutes: 20,
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
      { id: "basics", title: "Basics", order: 1, skillIds: ["first-skill"] },
    ],
    skills: [
      {
        id: "first-skill",
        title: "First skill",
        description: "Replace this with the thing you want to teach.",
        prerequisites: [],
        difficulty: 1,
        masteryThreshold: 0.9,
        estimatedMinutes: 20,
        tags: ["example"],
      },
    ],
  },
  items: [
    {
      id: "first-explain",
      type: "explain",
      skillIds: ["first-skill"],
      difficulty: 1,
      prompt: "What is this skill about?",
      body: "Replace this explanation with your own. Keep it short and concrete.",
      hints: [],
    },
    {
      id: "first-mcq-1",
      type: "mcq",
      skillIds: ["first-skill"],
      difficulty: 1,
      prompt: "Which answer is correct?",
      options: [
        { id: "a", text: "The correct answer" },
        {
          id: "b",
          text: "A useful distractor",
          misconceptionId: "first-misconception",
        },
      ],
      correctOptionId: "a",
      explanation: "Explain why the correct answer is right.",
      hints: [{ level: 1, text: "Start with the definition." }],
    },
    {
      id: "first-mcq-2",
      type: "mcq",
      skillIds: ["first-skill"],
      difficulty: 1,
      prompt: "Which statement is false?",
      options: [
        {
          id: "a",
          text: "A statement that confuses the idea",
          misconceptionId: "first-misconception",
        },
        { id: "b", text: "A statement that is true" },
      ],
      correctOptionId: "b",
      explanation: "Name the false statement and why it is false.",
      hints: [],
    },
    {
      id: "first-short",
      type: "short_answer",
      skillIds: ["first-skill"],
      difficulty: 1,
      prompt: "Give one example of this skill in practice.",
      scoring: { mode: "contains", value: "example" },
      modelAnswer: "An example that shows the skill in a real situation.",
      hints: [{ level: 1, text: "Use the word example in a real sentence." }],
    },
  ],
  rubrics: [],
  misconceptions: [
    {
      id: "first-misconception",
      label: "Confuses the core idea",
      skillIds: ["first-skill"],
      description: "Replace this with the misconception you want to catch.",
      remediation: {
        strategy: "contrast",
        explanation: "Contrast the wrong idea with the right one.",
        itemIds: ["first-explain"],
      },
    },
  ],
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
};

export interface DraftResult {
  pack?: ContentPack;
  errors: string[];
  warnings: string[];
}

export function starterPackText(): string {
  return JSON.stringify(STARTER_PACK, null, 2);
}

export function validatePackText(text: string): DraftResult {
  try {
    const result = validatePack(JSON.parse(text));
    return {
      pack: result.pack,
      errors: result.errors,
      warnings: result.warnings,
    };
  } catch (error) {
    return {
      errors: [
        `JSON: ${error instanceof Error ? error.message : String(error)}`,
      ],
      warnings: [],
    };
  }
}

export function formatPackText(text: string): string {
  return JSON.stringify(JSON.parse(text), null, 2);
}

export async function exportPack(pack: ContentPack): Promise<boolean> {
  const contents = JSON.stringify(pack, null, 2);
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({
      defaultPath: `${pack.manifest.id}-${pack.manifest.version}.json`,
      filters: [{ name: "Cairn pack", extensions: ["json"] }],
    });
    if (!path) return false;
    await invoke("write_text_file", { path, contents });
    return true;
  } catch {
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${pack.manifest.id}-${pack.manifest.version}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }
}
