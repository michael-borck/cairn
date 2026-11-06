import { contentPackSchema, type ContentPack, type Item } from "./schema";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  pack?: ContentPack;
}

interface IssueLike {
  path: PropertyKey[];
  message: string;
}

function issueText(issue: IssueLike): string {
  const path = issue.path.length
    ? issue.path.map((part) => String(part)).join(".")
    : "root";
  return `${path}: ${issue.message}`;
}

function duplicates<T>(values: T[], key: (value: T) => string): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

function checkPrerequisiteCycles(pack: ContentPack, errors: string[]): void {
  const skills = new Map(pack.curriculum.skills.map((skill) => [skill.id, skill]));
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string, stack: string[]): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      const cycle = [...stack.slice(start), id].join(" -> ");
      errors.push(`skill ${id}: prerequisite cycle (${cycle})`);
      return;
    }
    visiting.add(id);
    const skill = skills.get(id);
    for (const prerequisite of skill?.prerequisites ?? []) {
      if (!skills.has(prerequisite)) {
        errors.push(`skill ${id}: unknown prerequisite ${prerequisite}`);
        continue;
      }
      visit(prerequisite, [...stack, id]);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const skill of pack.curriculum.skills) visit(skill.id, []);
}

function isExternalPath(path: string): boolean {
  return /^(?:https?:)?\/\//i.test(path) || /^(?:data|blob):/i.test(path);
}

function checkMedia(item: Item, errors: string[]): void {
  for (const media of item.media) {
    if (isExternalPath(media.path)) {
      errors.push(`item ${item.id}: media must be local, got ${media.path}`);
    }
  }
}

function checkHints(item: Item, errors: string[], warnings: string[]): void {
  const levels = new Set<number>();
  for (const hint of item.hints) {
    if (levels.has(hint.level)) {
      warnings.push(`item ${item.id}: duplicate hint level ${hint.level}`);
    }
    levels.add(hint.level);
    if (hint.level === 1 && hint.revealsAnswer) {
      errors.push(`item ${item.id}: hint level 1 must not reveal the answer`);
    }
  }
}

function checkItems(
  pack: ContentPack,
  skillIds: Set<string>,
  rubricIds: Set<string>,
  labIds: Set<string>,
  misconceptionIds: Set<string>,
  errors: string[],
  warnings: string[]
): void {
  const itemIds = new Set(pack.items.map((item) => item.id));
  for (const item of pack.items) {
    for (const skillId of item.skillIds) {
      if (!skillIds.has(skillId)) {
        errors.push(`item ${item.id}: unknown skill ${skillId}`);
      }
    }
    if (item.variantOf && !itemIds.has(item.variantOf)) {
      errors.push(`item ${item.id}: unknown variantOf ${item.variantOf}`);
    }
    for (const misconceptionId of item.misconceptionIds) {
      if (!misconceptionIds.has(misconceptionId)) {
        errors.push(`item ${item.id}: unknown misconception ${misconceptionId}`);
      }
    }
    checkMedia(item, errors);
    checkHints(item, errors, warnings);

    if (item.type === "mcq") {
      const optionIds = new Set<string>();
      for (const option of item.options) {
        if (optionIds.has(option.id)) {
          errors.push(`item ${item.id}: duplicate option id ${option.id}`);
        }
        optionIds.add(option.id);
        if (option.misconceptionId && !misconceptionIds.has(option.misconceptionId)) {
          errors.push(
            `item ${item.id}: option ${option.id} has unknown misconception ${option.misconceptionId}`
          );
        }
        if (option.id !== item.correctOptionId && !option.misconceptionId) {
          warnings.push(
            `item ${item.id}: distractor ${option.id} has no misconception mapping`
          );
        }
      }
      if (!optionIds.has(item.correctOptionId)) {
        errors.push(`item ${item.id}: correctOptionId does not match an option`);
      }
    }

    if (item.type === "short_answer") {
      if (item.scoring.mode === "rubric") {
        if (!item.scoring.rubricId || !rubricIds.has(item.scoring.rubricId)) {
          errors.push(`item ${item.id}: rubric scoring needs a known rubricId`);
        }
      } else if (!item.scoring.value) {
        errors.push(`item ${item.id}: ${item.scoring.mode} scoring needs a value`);
      }
    }

    if (item.type === "teach_back" && !rubricIds.has(item.rubricId)) {
      errors.push(`item ${item.id}: unknown rubric ${item.rubricId}`);
    }

    if (item.type === "lab" && !labIds.has(item.labId)) {
      errors.push(`item ${item.id}: unknown lab ${item.labId}`);
    }
  }
}

function checkRubrics(pack: ContentPack, errors: string[], warnings: string[]): void {
  for (const rubric of pack.rubrics) {
    const criterionIds = new Set<string>();
    let total = 0;
    for (const criterion of rubric.criteria) {
      if (criterionIds.has(criterion.id)) {
        errors.push(`rubric ${rubric.id}: duplicate criterion ${criterion.id}`);
      }
      criterionIds.add(criterion.id);
      total += criterion.weight;
    }
    if (Math.abs(total - 1) > 0.001) {
      warnings.push(`rubric ${rubric.id}: weights total ${total.toFixed(3)}, expected 1.0`);
    }
  }
}

function checkMisconceptions(
  pack: ContentPack,
  skillIds: Set<string>,
  itemIds: Set<string>,
  errors: string[]
): void {
  for (const misconception of pack.misconceptions) {
    for (const skillId of misconception.skillIds) {
      if (!skillIds.has(skillId)) {
        errors.push(`misconception ${misconception.id}: unknown skill ${skillId}`);
      }
    }
    for (const itemId of misconception.remediation.itemIds) {
      if (!itemIds.has(itemId)) {
        errors.push(
          `misconception ${misconception.id}: unknown remediation item ${itemId}`
        );
      }
    }
  }
}

function checkLabs(
  pack: ContentPack,
  skillIds: Set<string>,
  errors: string[]
): void {
  for (const lab of pack.labs) {
    for (const skillId of lab.skillIds) {
      if (!skillIds.has(skillId)) {
        errors.push(`lab ${lab.id}: unknown skill ${skillId}`);
      }
    }
    const checkIds = new Set<string>();
    for (const check of lab.checks) {
      if (checkIds.has(check.id)) {
        errors.push(`lab ${lab.id}: duplicate check ${check.id}`);
      }
      checkIds.add(check.id);
      if (check.type === "manual" && !check.answer) {
        errors.push(`lab ${lab.id}: manual check ${check.id} needs an answer`);
      }
      if (check.type === "paste_output" && !check.expectedOutput) {
        errors.push(
          `lab ${lab.id}: paste_output check ${check.id} needs expectedOutput`
        );
      }
    }
  }
}

function checkPolicy(pack: ContentPack, errors: string[], warnings: string[]): void {
  const policy = pack.policy;
  if (policy.targetSuccessMin > policy.targetSuccessMax) {
    errors.push("policy: targetSuccessMin is greater than targetSuccessMax");
  }
  for (let index = 1; index < policy.reviewIntervalsDays.length; index += 1) {
    const previous = policy.reviewIntervalsDays[index - 1];
    const current = policy.reviewIntervalsDays[index];
    if (current <= previous) {
      warnings.push("policy: reviewIntervalsDays should be strictly increasing");
      break;
    }
  }
}

function checkSkillCoverage(pack: ContentPack, warnings: string[]): void {
  const bySkill = new Map<string, Item[]>();
  for (const item of pack.items) {
    for (const skillId of item.skillIds) {
      const list = bySkill.get(skillId) ?? [];
      list.push(item);
      bySkill.set(skillId, list);
    }
  }
  const practice = new Set([
    "mcq",
    "short_answer",
    "teach_back",
    "lab",
    "reflection",
  ]);
  for (const skill of pack.curriculum.skills) {
    const items = bySkill.get(skill.id) ?? [];
    const practiceCount = items.filter((item) => practice.has(item.type)).length;
    const explanatoryCount = items.filter(
      (item) => item.type === "explain" || item.type === "worked_example"
    ).length;
    if (items.length === 0) {
      warnings.push(`skill ${skill.id}: no items`);
    } else {
      if (practiceCount < 3) {
        warnings.push(`skill ${skill.id}: fewer than 3 practice items`);
      }
      if (explanatoryCount === 0) {
        warnings.push(`skill ${skill.id}: no explain or worked_example item`);
      }
    }
  }

  const covered = new Set(pack.curriculum.modules.flatMap((module) => module.skillIds));
  for (const skill of pack.curriculum.skills) {
    if (!covered.has(skill.id)) {
      warnings.push(`skill ${skill.id}: not referenced by any module`);
    }
  }
}

export function validatePack(input: unknown): ValidationResult {
  const parsed = contentPackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(issueText),
      warnings: [],
    };
  }

  const pack = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const skillIds = new Set(pack.curriculum.skills.map((skill) => skill.id));
  const itemIds = new Set(pack.items.map((item) => item.id));
  const rubricIds = new Set(pack.rubrics.map((rubric) => rubric.id));
  const labIds = new Set(pack.labs.map((lab) => lab.id));
  const misconceptionIds = new Set(
    pack.misconceptions.map((misconception) => misconception.id)
  );

  for (const id of duplicates(pack.curriculum.skills, (skill) => skill.id)) {
    errors.push(`curriculum: duplicate skill id ${id}`);
  }
  for (const id of duplicates(pack.curriculum.modules, (module) => module.id)) {
    errors.push(`curriculum: duplicate module id ${id}`);
  }
  for (const id of duplicates(pack.items, (item) => item.id)) {
    errors.push(`items: duplicate item id ${id}`);
  }
  for (const id of duplicates(pack.rubrics, (rubric) => rubric.id)) {
    errors.push(`rubrics: duplicate rubric id ${id}`);
  }
  for (const id of duplicates(pack.labs, (lab) => lab.id)) {
    errors.push(`labs: duplicate lab id ${id}`);
  }
  for (const id of duplicates(pack.misconceptions, (misconception) => misconception.id)) {
    errors.push(`misconceptions: duplicate id ${id}`);
  }

  checkPrerequisiteCycles(pack, errors);

  for (const module of pack.curriculum.modules) {
    for (const skillId of module.skillIds) {
      if (!skillIds.has(skillId)) {
        errors.push(`module ${module.id}: unknown skill ${skillId}`);
      }
    }
  }

  for (const skill of pack.curriculum.skills) {
    if (skill.deprecated) {
      if (!skill.replacedBy) {
        warnings.push(`skill ${skill.id}: deprecated without replacedBy`);
      } else if (!skillIds.has(skill.replacedBy)) {
        errors.push(`skill ${skill.id}: unknown replacedBy ${skill.replacedBy}`);
      } else if (skill.replacedBy === skill.id) {
        errors.push(`skill ${skill.id}: replacedBy points to itself`);
      }
    }
  }

  checkItems(
    pack,
    skillIds,
    rubricIds,
    labIds,
    misconceptionIds,
    errors,
    warnings
  );
  checkRubrics(pack, errors, warnings);
  checkMisconceptions(pack, skillIds, itemIds, errors);
  checkLabs(pack, skillIds, errors);
  checkPolicy(pack, errors, warnings);
  checkSkillCoverage(pack, warnings);

  if (pack.manifest.requires.docker && pack.labs.length === 0) {
    warnings.push("manifest: docker is required but the pack has no labs");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    pack,
  };
}
