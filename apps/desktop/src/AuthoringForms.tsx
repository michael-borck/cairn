import { useState } from "react";
import { itemSchema } from "@cairn/content";

import { askOllama, type AISettings } from "./ai";

export type PackData = Record<string, any>;
export type Update = (mutator: (data: PackData) => void) => void;

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="form-field form-field-wide">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number | undefined;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const DIFFICULTIES = [1, 2, 3, 4, 5].map((value) => ({
  value: String(value),
  label: `Level ${value}`,
}));

export function MetadataForm({ data, update }: { data: PackData; update: Update }) {
  const manifest = data.manifest ?? {};
  return (
    <div className="form-grid">
      <Field
        label="Pack id"
        value={manifest.id}
        onChange={(value) => update((draft) => { draft.manifest.id = value; })}
      />
      <Field
        label="Version"
        value={manifest.version}
        onChange={(value) => update((draft) => { draft.manifest.version = value; })}
      />
      <Field
        label="Title"
        value={manifest.title}
        onChange={(value) => update((draft) => { draft.manifest.title = value; })}
      />
      <Field
        label="Author"
        value={manifest.author?.name}
        onChange={(value) =>
          update((draft) => {
            draft.manifest.author = { ...(draft.manifest.author ?? {}), name: value };
          })
        }
      />
      <Field
        label="Licence"
        value={manifest.license}
        onChange={(value) => update((draft) => { draft.manifest.license = value; })}
      />
      <Field
        label="Language"
        value={manifest.language}
        onChange={(value) => update((draft) => { draft.manifest.language = value; })}
      />
      <Select
        label="Level"
        value={manifest.level}
        options={[
          { value: "beginner", label: "Beginner" },
          { value: "intermediate", label: "Intermediate" },
          { value: "advanced", label: "Advanced" },
          { value: "mixed", label: "Mixed" },
        ]}
        onChange={(value) => update((draft) => { draft.manifest.level = value; })}
      />
      <Field
        label="Estimated minutes"
        type="number"
        value={manifest.estimatedMinutes}
        onChange={(value) =>
          update((draft) => { draft.manifest.estimatedMinutes = Number(value); })
        }
      />
      <Area
        label="Description"
        value={manifest.description}
        onChange={(value) => update((draft) => { draft.manifest.description = value; })}
      />
    </div>
  );
}

export function ModulesForm({ data, update }: { data: PackData; update: Update }) {
  const modules = data.curriculum?.modules ?? [];
  return (
    <div className="form-stack">
      {modules.map((module: any, index: number) => (
        <div className="form-card" key={module.id ?? index}>
          <div className="form-card-head">
            <strong>{module.title || module.id || "Module"}</strong>
            <button
              type="button"
              className="ghost-button small"
              onClick={() =>
                update((draft) => {
                  draft.curriculum.modules.splice(index, 1);
                })
              }
            >
              Remove
            </button>
          </div>
          <div className="form-grid">
            <Field
              label="Module id"
              value={module.id}
              onChange={(value) => update((draft) => { draft.curriculum.modules[index].id = value; })}
            />
            <Field
              label="Title"
              value={module.title}
              onChange={(value) => update((draft) => { draft.curriculum.modules[index].title = value; })}
            />
            <Field
              label="Order"
              type="number"
              value={module.order}
              onChange={(value) =>
                update((draft) => { draft.curriculum.modules[index].order = Number(value); })
              }
            />
            <Field
              label="Skill ids"
              value={(module.skillIds ?? []).join(", ")}
              placeholder="skill-one, skill-two"
              onChange={(value) =>
                update((draft) => { draft.curriculum.modules[index].skillIds = splitList(value); })
              }
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="ghost-button"
        onClick={() =>
          update((draft) => {
            draft.curriculum.modules = draft.curriculum.modules ?? [];
            const number = draft.curriculum.modules.length + 1;
            draft.curriculum.modules.push({
              id: `module-${number}`,
              title: `Module ${number}`,
              order: number,
              skillIds: [],
            });
          })
        }
      >
        Add module
      </button>
    </div>
  );
}

export function SkillsForm({ data, update }: { data: PackData; update: Update }) {
  const skills = data.curriculum?.skills ?? [];
  return (
    <div className="form-stack">
      {skills.map((skill: any, index: number) => (
        <div className="form-card" key={skill.id ?? index}>
          <div className="form-card-head">
            <strong>{skill.title || skill.id || "Skill"}</strong>
            <button
              type="button"
              className="ghost-button small"
              onClick={() =>
                update((draft) => {
                  const removed = draft.curriculum.skills[index]?.id;
                  draft.curriculum.skills.splice(index, 1);
                  for (const module of draft.curriculum.modules ?? []) {
                    module.skillIds = (module.skillIds ?? []).filter(
                      (id: string) => id !== removed
                    );
                  }
                  for (const item of draft.items ?? []) {
                    item.skillIds = (item.skillIds ?? []).filter(
                      (id: string) => id !== removed
                    );
                  }
                })
              }
            >
              Remove
            </button>
          </div>
          <div className="form-grid">
            <Field
              label="Skill id"
              value={skill.id}
              onChange={(value) => update((draft) => { draft.curriculum.skills[index].id = value; })}
            />
            <Field
              label="Title"
              value={skill.title}
              onChange={(value) => update((draft) => { draft.curriculum.skills[index].title = value; })}
            />
            <Select
              label="Difficulty"
              value={skill.difficulty}
              options={DIFFICULTIES}
              onChange={(value) =>
                update((draft) => { draft.curriculum.skills[index].difficulty = Number(value); })
              }
            />
            <Field
              label="Mastery threshold"
              type="number"
              value={skill.masteryThreshold ?? 0.9}
              onChange={(value) =>
                update((draft) => { draft.curriculum.skills[index].masteryThreshold = Number(value); })
              }
            />
            <Field
              label="Prerequisites"
              value={(skill.prerequisites ?? []).join(", ")}
              placeholder="skill-one, skill-two"
              onChange={(value) =>
                update((draft) => { draft.curriculum.skills[index].prerequisites = splitList(value); })
              }
            />
            <Field
              label="Tags"
              value={(skill.tags ?? []).join(", ")}
              onChange={(value) =>
                update((draft) => { draft.curriculum.skills[index].tags = splitList(value); })
              }
            />
            <Area
              label="Description"
              value={skill.description}
              onChange={(value) => update((draft) => { draft.curriculum.skills[index].description = value; })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="ghost-button"
        onClick={() =>
          update((draft) => {
            draft.curriculum.skills = draft.curriculum.skills ?? [];
            const number = draft.curriculum.skills.length + 1;
            draft.curriculum.skills.push({
              id: `skill-${number}`,
              title: `Skill ${number}`,
              description: "",
              prerequisites: [],
              difficulty: 1,
              masteryThreshold: 0.9,
              tags: [],
            });
          })
        }
      >
        Add skill
      </button>
    </div>
  );
}

export function ItemsForm({ data, update }: { data: PackData; update: Update }) {
  const items = data.items ?? [];
  const firstSkill = data.curriculum?.skills?.[0]?.id ?? "";

  function setType(index: number, type: string) {
    update((draft) => {
      const item = draft.items[index];
      item.type = type;
      if (type === "mcq" && !item.options?.length) {
        item.options = [
          { id: "a", text: "Correct answer" },
          { id: "b", text: "Distractor", misconceptionId: "" },
        ];
        item.correctOptionId = "a";
      }
      if (type === "explain" && item.body === undefined) item.body = "";
      if (type === "worked_example" && !item.steps?.length) {
        item.steps = [{ title: "Step 1", body: "" }];
      }
      if (type === "short_answer" && !item.scoring) {
        item.scoring = { mode: "contains", value: "" };
      }
      if (type === "teach_back" && !item.rubricId) {
        item.rubricId = draft.rubrics?.[0]?.id ?? "";
      }
      if (type === "lab" && !item.labId) {
        item.labId = draft.labs?.[0]?.id ?? "";
      }
      if (type === "reflection" && !item.prompts?.length) {
        item.prompts = ["What did you notice?"];
      }
    });
  }

  return (
    <div className="form-stack">
      <p className="hint">
        Common fields are here. Hints, media, and other advanced fields remain
        available in the JSON tab.
      </p>
      {items.map((item: any, index: number) => (
        <details className="form-card" key={item.id ?? index}>
          <summary>
            {item.id || `Item ${index + 1}`} · {item.type} · {item.prompt || "No prompt"}
          </summary>
          <div className="form-card-head">
            <span />
            <button
              type="button"
              className="ghost-button small"
              onClick={() =>
                update((draft) => {
                  draft.items.splice(index, 1);
                })
              }
            >
              Remove
            </button>
          </div>
          <div className="form-grid">
            <Field
              label="Item id"
              value={item.id}
              onChange={(value) => update((draft) => { draft.items[index].id = value; })}
            />
            <Select
              label="Type"
              value={item.type}
              options={[
                { value: "explain", label: "Explain" },
                { value: "worked_example", label: "Worked example" },
                { value: "mcq", label: "Multiple choice" },
                { value: "short_answer", label: "Short answer" },
                { value: "teach_back", label: "Teach back" },
                { value: "lab", label: "Lab" },
                { value: "reflection", label: "Reflection" },
              ]}
              onChange={(value) => setType(index, value)}
            />
            <Select
              label="Difficulty"
              value={item.difficulty}
              options={DIFFICULTIES}
              onChange={(value) =>
                update((draft) => { draft.items[index].difficulty = Number(value); })
              }
            />
            <Field
              label="Skill ids"
              value={(item.skillIds ?? []).join(", ")}
              onChange={(value) =>
                update((draft) => { draft.items[index].skillIds = splitList(value); })
              }
            />
            <Area
              label="Prompt"
              value={item.prompt}
              onChange={(value) => update((draft) => { draft.items[index].prompt = value; })}
            />
            <Area
              label="Explanation"
              value={item.explanation}
              onChange={(value) => update((draft) => { draft.items[index].explanation = value; })}
            />

            {item.type === "explain" && (
              <Area
                label="Body"
                rows={6}
                value={item.body}
                onChange={(value) => update((draft) => { draft.items[index].body = value; })}
              />
            )}

            {item.type === "worked_example" && (
              <div className="form-wide">
                <div className="form-card-head">
                  <span>Steps</span>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() =>
                      update((draft) => {
                        draft.items[index].steps = draft.items[index].steps ?? [];
                        draft.items[index].steps.push({ title: "New step", body: "" });
                      })
                    }
                  >
                    Add step
                  </button>
                </div>
                {(item.steps ?? []).map((step: any, stepIndex: number) => (
                  <div className="sub-card" key={stepIndex}>
                    <Field
                      label="Step title"
                      value={step.title}
                      onChange={(value) =>
                        update((draft) => { draft.items[index].steps[stepIndex].title = value; })
                      }
                    />
                    <Area
                      label="Step body"
                      value={step.body}
                      onChange={(value) =>
                        update((draft) => { draft.items[index].steps[stepIndex].body = value; })
                      }
                    />
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={() =>
                        update((draft) => {
                          draft.items[index].steps.splice(stepIndex, 1);
                        })
                      }
                    >
                      Remove step
                    </button>
                  </div>
                ))}
              </div>
            )}

            {item.type === "mcq" && (
              <div className="form-wide">
                <div className="form-card-head">
                  <span>Options</span>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() =>
                      update((draft) => {
                        draft.items[index].options = draft.items[index].options ?? [];
                        const next = draft.items[index].options.length + 1;
                        draft.items[index].options.push({
                          id: `o${next}`,
                          text: "New option",
                          misconceptionId: "",
                        });
                      })
                    }
                  >
                    Add option
                  </button>
                </div>
                {(item.options ?? []).map((option: any, optionIndex: number) => (
                  <div className="option-edit" key={option.id ?? optionIndex}>
                    <input
                      type="radio"
                      name={`correct-${index}`}
                      checked={item.correctOptionId === option.id}
                      onChange={() =>
                        update((draft) => { draft.items[index].correctOptionId = option.id; })
                      }
                      aria-label="Correct option"
                    />
                    <Field
                      label="Option id"
                      value={option.id}
                      onChange={(value) =>
                        update((draft) => { draft.items[index].options[optionIndex].id = value; })
                      }
                    />
                    <Field
                      label="Text"
                      value={option.text}
                      onChange={(value) =>
                        update((draft) => { draft.items[index].options[optionIndex].text = value; })
                      }
                    />
                    <Field
                      label="Misconception id"
                      value={option.misconceptionId}
                      onChange={(value) =>
                        update((draft) => {
                          draft.items[index].options[optionIndex].misconceptionId = value;
                        })
                      }
                    />
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={() =>
                        update((draft) => {
                          draft.items[index].options.splice(optionIndex, 1);
                          if (
                            !draft.items[index].options.some(
                              (entry: any) => entry.id === draft.items[index].correctOptionId
                            )
                          ) {
                            draft.items[index].correctOptionId =
                              draft.items[index].options[0]?.id ?? "";
                          }
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {item.type === "short_answer" && (
              <>
                <Select
                  label="Scoring"
                  value={item.scoring?.mode}
                  options={[
                    { value: "exact", label: "Exact" },
                    { value: "contains", label: "Contains" },
                    { value: "regex", label: "Regex" },
                    { value: "rubric", label: "Rubric" },
                  ]}
                  onChange={(value) =>
                    update((draft) => {
                      draft.items[index].scoring = {
                        ...(draft.items[index].scoring ?? {}),
                        mode: value,
                      };
                    })
                  }
                />
                <Field
                  label="Expected value"
                  value={item.scoring?.value}
                  onChange={(value) =>
                    update((draft) => {
                      draft.items[index].scoring = {
                        ...(draft.items[index].scoring ?? {}),
                        value,
                      };
                    })
                  }
                />
                <Field
                  label="Rubric id"
                  value={item.scoring?.rubricId}
                  onChange={(value) =>
                    update((draft) => {
                      draft.items[index].scoring = {
                        ...(draft.items[index].scoring ?? {}),
                        rubricId: value,
                      };
                    })
                  }
                />
                <Area
                  label="Model answer"
                  value={item.modelAnswer}
                  onChange={(value) => update((draft) => { draft.items[index].modelAnswer = value; })}
                />
              </>
            )}

            {item.type === "teach_back" && (
              <>
                <Field
                  label="Rubric id"
                  value={item.rubricId}
                  onChange={(value) => update((draft) => { draft.items[index].rubricId = value; })}
                />
                <Area
                  label="Model answer"
                  value={item.modelAnswer}
                  onChange={(value) => update((draft) => { draft.items[index].modelAnswer = value; })}
                />
              </>
            )}

            {item.type === "lab" && (
              <Field
                label="Lab id"
                value={item.labId}
                onChange={(value) => update((draft) => { draft.items[index].labId = value; })}
              />
            )}

            {item.type === "reflection" && (
              <Area
                label="Prompts (one per line)"
                rows={4}
                value={(item.prompts ?? []).join("\n")}
                onChange={(value) =>
                  update((draft) => {
                    draft.items[index].prompts = value
                      .split("\n")
                      .map((line: string) => line.trim())
                      .filter(Boolean);
                  })
                }
              />
            )}
          </div>
        </details>
      ))}
      <button
        type="button"
        className="ghost-button"
        onClick={() =>
          update((draft) => {
            draft.items = draft.items ?? [];
            const number = draft.items.length + 1;
            draft.items.push({
              id: `item-${number}`,
              type: "explain",
              skillIds: firstSkill ? [firstSkill] : [],
              difficulty: 1,
              prompt: "New prompt",
              body: "",
              hints: [],
            });
          })
        }
      >
        Add item
      </button>
    </div>
  );
}

export function PolicyForm({ data, update }: { data: PackData; update: Update }) {
  const policy = data.policy ?? {};
  return (
    <div className="form-grid">
      <Field
        label="Mastery threshold"
        type="number"
        value={policy.masteryThreshold ?? 0.9}
        onChange={(value) => update((draft) => { draft.policy.masteryThreshold = Number(value); })}
      />
      <Field
        label="Target success min"
        type="number"
        value={policy.targetSuccessMin ?? 0.75}
        onChange={(value) => update((draft) => { draft.policy.targetSuccessMin = Number(value); })}
      />
      <Field
        label="Target success max"
        type="number"
        value={policy.targetSuccessMax ?? 0.85}
        onChange={(value) => update((draft) => { draft.policy.targetSuccessMax = Number(value); })}
      />
      <Field
        label="Confidence sample rate"
        type="number"
        value={policy.confidenceSampleRate ?? 0.2}
        onChange={(value) => update((draft) => { draft.policy.confidenceSampleRate = Number(value); })}
      />
      <Field
        label="Review intervals (days)"
        value={(policy.reviewIntervalsDays ?? []).join(", ")}
        onChange={(value) =>
          update((draft) => {
            draft.policy.reviewIntervalsDays = splitList(value).map(Number).filter(Number.isFinite);
          })
        }
      />
      <Field
        label="Hysteresis observations"
        type="number"
        value={policy.hysteresis?.observations ?? 2}
        onChange={(value) =>
          update((draft) => {
            draft.policy.hysteresis = { ...(draft.policy.hysteresis ?? {}), observations: Number(value) };
          })
        }
      />
      <Field
        label="Min items between changes"
        type="number"
        value={policy.hysteresis?.minItemsBetweenChanges ?? 3}
        onChange={(value) =>
          update((draft) => {
            draft.policy.hysteresis = {
              ...(draft.policy.hysteresis ?? {}),
              minItemsBetweenChanges: Number(value),
            };
          })
        }
      />
      <Field
        label="Escalate help after wrong"
        type="number"
        value={policy.help?.escalateAfterWrong ?? 2}
        onChange={(value) =>
          update((draft) => {
            draft.policy.help = { ...(draft.policy.help ?? {}), escalateAfterWrong: Number(value) };
          })
        }
      />
      <Field
        label="Fade help after correct"
        type="number"
        value={policy.help?.fadeAfterCorrect ?? 2}
        onChange={(value) =>
          update((draft) => {
            draft.policy.help = { ...(draft.policy.help ?? {}), fadeAfterCorrect: Number(value) };
          })
        }
      />
      <p className="hint form-wide">
        Help start levels remain in the JSON tab. All policy changes still run
        through the same validator before saving.
      </p>
    </div>
  );
}


function normalizeHints(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((hint) =>
    typeof hint === "string" ? { level: 1, text: hint } : hint
  );
}

function generatedItems(
  response: string,
  skillId: string
): { items: any[]; error?: string } {
  let parsed: unknown;
  try {
    const start = response.indexOf("[");
    const end = response.lastIndexOf("]");
    const json =
      start >= 0 && end > start ? response.slice(start, end + 1) : response;
    parsed = JSON.parse(json);
  } catch {
    return { items: [], error: "AI did not return valid JSON." };
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { items?: unknown }).items)
      ? ((parsed as { items: unknown[] }).items)
      : null;
  if (!list) {
    return { items: [], error: "AI did not return an array of items." };
  }

  const items: any[] = [];
  const issues: string[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") {
      issues.push("an item was not an object");
      continue;
    }
    const entry = raw as Record<string, any>;
    if (entry.type !== "mcq" && entry.type !== "short_answer") {
      issues.push(`unsupported type ${String(entry.type)}`);
      continue;
    }
    const difficulty = Number(entry.difficulty);
    const candidate: Record<string, any> = {
      ...entry,
      id: `ai-${Date.now().toString(36)}-${items.length + 1}`,
      skillIds: [skillId],
      difficulty: Number.isInteger(difficulty)
        ? Math.min(5, Math.max(1, difficulty))
        : 2,
      hints: normalizeHints(entry.hints),
      media: [],
      misconceptionIds: [],
    };
    delete candidate.source;
    delete candidate.variantOf;
    delete candidate.labId;

    const parsedItem = itemSchema.safeParse(candidate);
    if (!parsedItem.success) {
      issues.push(
        `${entry.type}: ${parsedItem.error.issues[0]?.message ?? "invalid item"}`
      );
      continue;
    }
    if (parsedItem.data.type === "mcq") {
      const optionIds = new Set(parsedItem.data.options.map((option) => option.id));
      if (!optionIds.has(parsedItem.data.correctOptionId)) {
        issues.push("mcq: correctOptionId does not match an option");
        continue;
      }
    }
    if (parsedItem.data.type === "short_answer") {
      if (
        parsedItem.data.scoring.mode === "rubric" ||
        !parsedItem.data.scoring.value
      ) {
        issues.push("short_answer: use contains, exact, or regex with a value");
        continue;
      }
    }
    items.push(parsedItem.data);
  }

  if (items.length === 0) {
    return {
      items,
      error: issues[0] ?? "AI did not produce a usable practice item.",
    };
  }
  return { items };
}

export function PracticeGenerator({
  data,
  update,
  aiSettings,
}: {
  data: PackData;
  update: Update;
  aiSettings: AISettings;
}) {
  const skills = data.curriculum?.skills ?? [];
  const [skillId, setSkillId] = useState<string>(skills[0]?.id ?? "");
  const selected = skills.find((skill: any) => skill.id === skillId) ?? skills[0];
  const [generated, setGenerated] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate(): Promise<void> {
    if (!selected) return;
    setGenerating(true);
    setError("");
    setGenerated([]);
    try {
      const materials = (data.items ?? [])
        .filter(
          (item: any) =>
            item.skillIds?.includes(selected.id) &&
            (item.type === "explain" || item.type === "worked_example")
        )
        .map((item: any) => `${item.prompt}\n${item.body ?? ""}`)
        .join("\n\n")
        .slice(0, 6000);
      const system =
        "You write practice items for a local study app. Return JSON only. No markdown fences, no commentary.";
      const prompt = [
        `Skill: ${selected.title}`,
        selected.description ? `Description: ${selected.description}` : "",
        materials ? `Source material:\n${materials}` : "",
        "Write 3 practice items for this skill.",
        "Allowed types: mcq and short_answer only.",
        "Return a JSON array of item objects.",
        "MCQ shape: {\"type\":\"mcq\",\"difficulty\":2,\"prompt\":\"...\",\"options\":[{\"id\":\"a\",\"text\":\"...\"},{\"id\":\"b\",\"text\":\"...\"}],\"correctOptionId\":\"a\",\"explanation\":\"...\",\"hints\":[{\"level\":1,\"text\":\"...\"}]}",
        "Short answer shape: {\"type\":\"short_answer\",\"difficulty\":2,\"prompt\":\"...\",\"scoring\":{\"mode\":\"contains\",\"value\":\"keyword\"},\"modelAnswer\":\"...\",\"hints\":[]}",
        "Use 2 to 4 options for MCQ. Exactly one correct option. Make each prompt self-contained.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const response = await askOllama(aiSettings, system, prompt);
      const result = generatedItems(response, selected.id);
      setGenerated(result.items);
      setError(result.error ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setGenerating(false);
    }
  }

  function insert(): void {
    if (generated.length === 0) return;
    update((draft) => {
      draft.items = draft.items ?? [];
      draft.items.push(...generated);
    });
    setGenerated([]);
    setError("");
  }

  return (
    <div className="generator">
      <div className="form-card-head">
        <strong>AI practice generator</strong>
        <span className="muted">Human review required</span>
      </div>
      <div className="generator-row">
        <select
          value={selected?.id ?? ""}
          onChange={(event) => setSkillId(event.target.value)}
        >
          {skills.map((skill: any) => (
            <option key={skill.id} value={skill.id}>
              {skill.title || skill.id}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button"
          onClick={() => void generate()}
          disabled={generating || !selected || aiSettings.mode === "off"}
        >
          {generating ? "Generating..." : "Generate 3 items"}
        </button>
      </div>
      {aiSettings.mode === "off" && (
        <p className="error-text">Turn on AI assist or full in the AI panel.</p>
      )}
      {error && <p className="error-text">{error}</p>}
      {generated.length > 0 && (
        <div className="generated-list">
          {generated.map((item) => (
            <div key={item.id} className="generated-item">
              <strong>{item.type}</strong>
              <span>{item.prompt}</span>
            </div>
          ))}
          <button type="button" className="button" onClick={insert}>
            Insert {generated.length} item(s)
          </button>
        </div>
      )}
    </div>
  );
}
