import { z } from "zod";

export const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export const idSchema = z
  .string()
  .min(1)
  .regex(ID_RE, "must be kebab-case");

export const semverSchema = z
  .string()
  .regex(SEMVER_RE, "must be a semantic version");

export const difficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const helpLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

export const mediaRefSchema = z.object({
  type: z.enum(["image", "diagram", "video"]),
  path: z.string().min(1),
  alt: z.string().min(1),
});

export const sourceRefSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional(),
  license: z.string().min(1),
});

export const hintSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  text: z.string().min(1),
  revealsAnswer: z.boolean().optional(),
});

export type Hint = z.infer<typeof hintSchema>;

export interface Scaffold {
  id: string;
  prompt: string;
  kind: "check" | "mcq";
  answer?: string;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  hints: Hint[];
  scaffolds: Scaffold[];
}

export const scaffoldSchema: z.ZodType<Scaffold, unknown> =
  z.lazy(() =>
    z.object({
      id: idSchema,
      prompt: z.string().min(1),
      kind: z.enum(["check", "mcq"]).default("check"),
      answer: z.string().min(1).optional(),
      options: z
        .array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(1),
          })
        )
        .min(2)
        .optional(),
      correctOptionId: z.string().min(1).optional(),
      hints: z.array(hintSchema).default([]),
      scaffolds: z.array(scaffoldSchema).default([]),
    })
  );

export const manifestSchema = z.object({
  schemaVersion: z.literal("0.1"),
  id: idSchema,
  version: semverSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  author: z.object({
    name: z.string().min(1),
    url: z.string().url().optional(),
  }),
  license: z.string().min(1),
  source: z.string().url().optional(),
  language: z.string().min(2),
  audience: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced", "mixed"]),
  estimatedMinutes: z.number().positive(),
  engine: z.object({
    minVersion: semverSchema,
  }),
  requires: z.object({
    ai: z.boolean(),
    docker: z.boolean(),
    appNetwork: z.boolean(),
  }),
  entries: z.object({
    curriculum: z.string().min(1),
    items: z.string().min(1),
    rubrics: z.string().min(1),
    misconceptions: z.string().min(1),
    labs: z.string().min(1),
    policy: z.string().min(1),
  }),
});

export const skillSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  prerequisites: z.array(idSchema).default([]),
  difficulty: difficultySchema,
  masteryThreshold: z.number().min(0).max(1).optional(),
  estimatedMinutes: z.number().positive().optional(),
  tags: z.array(z.string().min(1)).default([]),
  deprecated: z.boolean().optional(),
  replacedBy: idSchema.optional(),
});

export const moduleSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  order: z.number().int().nonnegative(),
  skillIds: z.array(idSchema).min(1),
});

export const curriculumSchema = z.object({
  modules: z.array(moduleSchema).min(1),
  skills: z.array(skillSchema).min(1),
});

const itemBaseSchema = z.object({
  id: idSchema,
  skillIds: z.array(idSchema).min(1),
  difficulty: difficultySchema,
  prompt: z.string().min(1),
  media: z.array(mediaRefSchema).default([]),
  hints: z.array(hintSchema).default([]),
  explanation: z.string().optional(),
  misconceptionIds: z.array(idSchema).default([]),
  source: sourceRefSchema.optional(),
  estimatedSeconds: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1)).default([]),
  variantOf: idSchema.optional(),
  scaffolds: z.array(scaffoldSchema).default([]),
});

export const explainItemSchema = itemBaseSchema.extend({
  type: z.literal("explain"),
  body: z.string().min(1),
  check: z
    .object({
      prompt: z.string().min(1),
      answer: z.string().min(1),
    })
    .optional(),
});

export const workedExampleItemSchema = itemBaseSchema.extend({
  type: z.literal("worked_example"),
  steps: z
    .array(
      z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        media: z.array(mediaRefSchema).default([]),
      })
    )
    .min(1),
  checkpoint: z
    .object({
      prompt: z.string().min(1),
      answer: z.string().min(1),
    })
    .optional(),
});

export const mcqItemSchema = itemBaseSchema.extend({
  type: z.literal("mcq"),
  options: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string().min(1),
        misconceptionId: idSchema.optional(),
      })
    )
    .min(2),
  correctOptionId: z.string().min(1),
  confidencePrompt: z.boolean().optional(),
});

export const shortAnswerItemSchema = itemBaseSchema.extend({
  type: z.literal("short_answer"),
  scoring: z.object({
    mode: z.enum(["exact", "contains", "regex", "rubric"]),
    value: z.string().optional(),
    rubricId: idSchema.optional(),
  }),
  modelAnswer: z.string().optional(),
});

export const teachBackItemSchema = itemBaseSchema.extend({
  type: z.literal("teach_back"),
  rubricId: idSchema,
  modelAnswer: z.string().optional(),
});

export const labItemSchema = itemBaseSchema.extend({
  type: z.literal("lab"),
  labId: idSchema,
});

export const reflectionItemSchema = itemBaseSchema.extend({
  type: z.literal("reflection"),
  prompts: z.array(z.string().min(1)).min(1),
});

export const itemSchema = z.discriminatedUnion("type", [
  explainItemSchema,
  workedExampleItemSchema,
  mcqItemSchema,
  shortAnswerItemSchema,
  teachBackItemSchema,
  labItemSchema,
  reflectionItemSchema,
]);

export const rubricSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  criteria: z
    .array(
      z.object({
        id: idSchema,
        label: z.string().min(1),
        weight: z.number().positive(),
        levels: z.record(z.string(), z.string().min(1)),
      })
    )
    .min(1),
});

export const misconceptionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  skillIds: z.array(idSchema).min(1),
  description: z.string().min(1),
  remediation: z.object({
    strategy: z.enum(["contrast", "explain", "worked_example", "prerequisite"]),
    explanation: z.string().min(1),
    itemIds: z.array(idSchema).default([]),
  }),
});

export const labCheckSchema = z.object({
  id: idSchema,
  type: z.enum(["manual", "paste_output"]),
  prompt: z.string().min(1),
  answer: z.string().optional(),
  expectedOutput: z.string().optional(),
});

export const labSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  skillIds: z.array(idSchema).min(1),
  platforms: z.array(z.enum(["macos", "linux", "windows"])).min(1),
  setup: z.array(z.string().min(1)).default([]),
  task: z.string().min(1),
  commands: z.array(z.string().min(1)).min(1),
  checks: z.array(labCheckSchema).min(1),
  hints: z.array(hintSchema).default([]),
  solution: z.string().min(1),
  cleanup: z.array(z.string().min(1)).min(1),
  security: z.object({
    executesOnHost: z.literal(false),
    network: z.boolean(),
  }),
});

export const policySchema = z.object({
  id: z.string().min(1),
  targetSuccessMin: z.number().min(0).max(1),
  targetSuccessMax: z.number().min(0).max(1),
  masteryThreshold: z.number().min(0).max(1),
  reviewIntervalsDays: z.array(z.number().int().positive()).min(1),
  reviewCap: z.number().min(0).max(1).default(0.5),
  hysteresis: z.object({
    observations: z.number().int().positive(),
    minItemsBetweenChanges: z.number().int().nonnegative(),
  }),
  wrongStreak: z.object({
    similarItem: z.number().int().positive(),
    switchRepresentation: z.number().int().positive(),
    prerequisite: z.number().int().positive(),
  }),
  help: z.object({
    startLevelByMastery: z.record(
      z.string().regex(/^(0(?:\.\d+)?|1(?:\.0+)?)$/),
      helpLevelSchema
    ),
    escalateAfterWrong: z.number().int().positive(),
    fadeAfterCorrect: z.number().int().positive(),
  }),
  confidenceSampleRate: z.number().min(0).max(1),
});

export const contentPackSchema = z.object({
  manifest: manifestSchema,
  curriculum: curriculumSchema,
  items: z.array(itemSchema).min(1),
  rubrics: z.array(rubricSchema),
  misconceptions: z.array(misconceptionSchema),
  labs: z.array(labSchema),
  policy: policySchema,
});

export type Manifest = z.infer<typeof manifestSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type Curriculum = z.infer<typeof curriculumSchema>;
export type Item = z.infer<typeof itemSchema>;
export type ExplainItem = z.infer<typeof explainItemSchema>;
export type WorkedExampleItem = z.infer<typeof workedExampleItemSchema>;
export type MCQItem = z.infer<typeof mcqItemSchema>;
export type ShortAnswerItem = z.infer<typeof shortAnswerItemSchema>;
export type TeachBackItem = z.infer<typeof teachBackItemSchema>;
export type LabItem = z.infer<typeof labItemSchema>;
export type ReflectionItem = z.infer<typeof reflectionItemSchema>;
export type Rubric = z.infer<typeof rubricSchema>;
export type Misconception = z.infer<typeof misconceptionSchema>;
export type Lab = z.infer<typeof labSchema>;
export type LabCheck = z.infer<typeof labCheckSchema>;
export type Policy = z.infer<typeof policySchema>;
export type ContentPack = z.infer<typeof contentPackSchema>;
export type SkillId = string;
export type ItemId = string;
