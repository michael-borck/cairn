import type { ContentPack, Item, Skill, SkillId } from "@cairn/content";

import { isReviewDue, overdueDays } from "./review";
import {
  ENGINE_VERSION,
  type Decision,
  type DecisionAction,
  type LearnerState,
  type ReasonCode,
  type ReviewItem,
  type SkillState,
} from "./types";

export interface PolicyInput {
  pack: ContentPack;
  state: LearnerState;
  session: { goalSkillIds?: SkillId[]; availableMinutes: number; mode: string };
  now: Date;
  idFactory: () => string;
}

const PRACTICE_TYPES = new Set([
  "mcq",
  "short_answer",
  "teach_back",
  "lab",
  "reflection",
]);

export function orderedSkills(pack: ContentPack): Skill[] {
  const byId = new Map(pack.curriculum.skills.map((skill) => [skill.id, skill]));
  const ordered: Skill[] = [];
  const seen = new Set<string>();
  const modules = [...pack.curriculum.modules].sort((a, b) => a.order - b.order);
  for (const module of modules) {
    for (const skillId of module.skillIds) {
      const skill = byId.get(skillId);
      if (skill && !seen.has(skill.id)) {
        seen.add(skill.id);
        ordered.push(skill);
      }
    }
  }
  for (const skill of pack.curriculum.skills) {
    if (!seen.has(skill.id)) {
      seen.add(skill.id);
      ordered.push(skill);
    }
  }
  return ordered;
}

export function masteryOf(state: LearnerState, skillId: SkillId): number {
  return state.skills[skillId]?.mastery ?? 0;
}

export function thresholdFor(skill: Skill, pack: ContentPack): number {
  return skill.masteryThreshold ?? pack.policy.masteryThreshold;
}

function prerequisitesMet(
  skill: Skill,
  state: LearnerState,
  pack: ContentPack
): boolean {
  return (skill.prerequisites ?? []).every((id) => {
    const prerequisite = pack.curriculum.skills.find((item) => item.id === id);
    return masteryOf(state, id) >= (prerequisite ? thresholdFor(prerequisite, pack) : 0.5);
  });
}

function firstPrerequisiteGap(
  skill: Skill,
  state: LearnerState,
  pack: ContentPack
): Skill | undefined {
  for (const id of skill.prerequisites ?? []) {
    const prerequisite = pack.curriculum.skills.find((item) => item.id === id);
    if (!prerequisite) continue;
    if (masteryOf(state, id) < thresholdFor(prerequisite, pack)) {
      return prerequisite;
    }
  }
  return undefined;
}

function itemsForSkill(pack: ContentPack, skillId: SkillId): Item[] {
  return pack.items.filter((item) => item.skillIds.includes(skillId));
}

const TYPE_ORDER: Record<DecisionAction, string[]> = {
  diagnose: [
    "mcq",
    "short_answer",
    "explain",
    "worked_example",
    "lab",
    "teach_back",
    "reflection",
  ],
  explain: ["explain", "worked_example"],
  worked_example: ["worked_example", "explain"],
  practice: ["mcq", "short_answer", "teach_back", "lab", "reflection"],
  review: [
    "mcq",
    "short_answer",
    "teach_back",
    "lab",
    "explain",
    "worked_example",
    "reflection",
  ],
  remediate: ["explain", "worked_example", "mcq"],
  challenge: ["mcq", "short_answer", "lab", "teach_back"],
  complete: [],
};

export function selectItem(
  pack: ContentPack,
  skillId: SkillId,
  action: DecisionAction,
  mastery: number
): Item | undefined {
  const all = itemsForSkill(pack, skillId);
  if (all.length === 0) return undefined;

  const order = TYPE_ORDER[action];
  const preferred = all.filter((item) => order.includes(item.type));
  const candidates = preferred.length > 0 ? preferred : all;
  const targetDifficulty = 1 + mastery * 4;

  return [...candidates].sort((a, b) => {
    const distance =
      Math.abs(a.difficulty - targetDifficulty) -
      Math.abs(b.difficulty - targetDifficulty);
    if (distance !== 0) return distance;
    const typeDistance =
      order.indexOf(a.type) - order.indexOf(b.type);
    if (typeDistance !== 0) return typeDistance;
    return a.id.localeCompare(b.id);
  })[0];
}

function dueReview(
  pack: ContentPack,
  state: LearnerState,
  now: Date
): { skill: Skill; item: Item } | undefined {
  const due = orderedSkills(pack)
    .map((skill) => ({ skill, itemState: state.skills[skill.id] }))
    .filter(
      (entry): entry is { skill: Skill; itemState: SkillState } =>
        Boolean(entry.itemState && isReviewDue(entry.itemState, now))
    )
    .sort((a, b) => {
      const urgency =
        overdueDays(b.itemState, now) - overdueDays(a.itemState, now);
      if (urgency !== 0) return urgency;
      return a.itemState.mastery - b.itemState.mastery;
    });

  for (const entry of due) {
    const item = selectItem(pack, entry.skill.id, "review", entry.itemState.mastery);
    if (item) return { skill: entry.skill, item };
  }
  return undefined;
}

function targetSkill(
  pack: ContentPack,
  state: LearnerState,
  goalSkillIds?: SkillId[]
): Skill | undefined {
  const ordered = orderedSkills(pack).filter((skill) => !skill.deprecated);
  const goals = goalSkillIds?.length
    ? ordered.filter((skill) => goalSkillIds.includes(skill.id))
    : [];
  const pool = goals.length > 0 ? goals : ordered;
  const unmastered = pool.filter(
    (skill) => masteryOf(state, skill.id) < thresholdFor(skill, pack)
  );
  const ready = unmastered.find((skill) => prerequisitesMet(skill, state, pack));
  if (ready) return ready;
  if (unmastered.length > 0) return unmastered[0];
  return undefined;
}

function actionForMastery(
  mastery: number,
  threshold: number,
  consecutiveWrong: number
): { action: DecisionAction; reasonCode: ReasonCode; reason: string } {
  if (consecutiveWrong >= 2) {
    return {
      action: "worked_example",
      reasonCode: "wrong_streak_switch_representation",
      reason: "You have missed this skill twice, so we are switching to a worked example.",
    };
  }
  if (mastery < 0.4) {
    return {
      action: "explain",
      reasonCode: "low_mastery",
      reason: "Start with an explanation before more practice.",
    };
  }
  if (mastery < 0.7) {
    return {
      action: "practice",
      reasonCode: "guided_practice",
      reason: "You have the idea. Practise with hints available.",
    };
  }
  if (mastery < threshold) {
    return {
      action: "practice",
      reasonCode: "independent_practice",
      reason: "You are close. Practise without leaning on hints.",
    };
  }
  return {
    action: "review",
    reasonCode: "retention_check",
    reason: "Check that this still holds after a gap.",
  };
}

function makeDecision(
  input: PolicyInput,
  action: DecisionAction,
  item: Item | undefined,
  skill: Skill | undefined,
  reasonCode: ReasonCode,
  reason: string
): Decision {
  const state = input.state;
  const mastery = skill ? masteryOf(state, skill.id) : 0;
  const evidence = skill
    ? [
        `skill=${skill.id}`,
        `mastery=${mastery.toFixed(2)}`,
        `threshold=${thresholdFor(skill, input.pack).toFixed(2)}`,
        `attempts=${state.skills[skill.id]?.attempts ?? 0}`,
      ]
    : ["all skills mastered"];
  return {
    id: input.idFactory(),
    learnerId: state.learnerId,
    action,
    itemId: item?.id,
    skillIds: skill ? [skill.id] : [],
    reasonCode,
    reason: skill ? `${reason} (${skill.title})` : reason,
    evidence,
    confidence: mastery,
    alternatives: [],
    packVersion: input.pack.manifest.version,
    policyVersion: input.pack.policy.id,
    engineVersion: ENGINE_VERSION,
    createdAt: input.now.toISOString(),
  };
}

export function chooseNextDecision(input: PolicyInput): Decision {
  const { pack, state, now } = input;
  const review = dueReview(pack, state, now);
  if (review) {
    return makeDecision(
      input,
      "review",
      review.item,
      review.skill,
      "review_due",
      "Review is due for this skill."
    );
  }

  let target = targetSkill(pack, state, input.session.goalSkillIds);
  if (!target) {
    return makeDecision(
      input,
      "complete",
      undefined,
      undefined,
      "session_goal_met",
      "There is no unmastered skill left in this path."
    );
  }

  const gap = firstPrerequisiteGap(target, state, pack);
  if (gap) {
    const item = selectItem(pack, gap.id, "remediate", masteryOf(state, gap.id));
    if (item) {
      return makeDecision(
        input,
        "remediate",
        item,
        gap,
        "prerequisite_gap",
        "A prerequisite needs attention before this skill."
      );
    }
    target = gap;
  }

  const skillState = state.skills[target.id];
  const threshold = thresholdFor(target, pack);
  const mastery = skillState?.mastery ?? 0;
  const consecutiveWrong = skillState?.consecutiveWrong ?? 0;

  if (consecutiveWrong >= pack.policy.wrongStreak.prerequisite) {
    const item = selectItem(pack, target.id, "remediate", mastery);
    if (item) {
      return makeDecision(
        input,
        "remediate",
        item,
        target,
        "wrong_streak_switch_representation",
        "Several misses in a row. Step back and repair the concept."
      );
    }
  }

  const choice = actionForMastery(mastery, threshold, consecutiveWrong);
  let item = selectItem(pack, target.id, choice.action, mastery);
  if (!item) {
    item = selectItem(pack, target.id, "practice", mastery);
  }
  if (!item) {
    for (const skill of orderedSkills(pack)) {
      if (skill.deprecated) continue;
      if (masteryOf(state, skill.id) >= thresholdFor(skill, pack)) continue;
      const fallback = selectItem(pack, skill.id, "practice", masteryOf(state, skill.id));
      if (fallback) {
        return makeDecision(
          input,
          "practice",
          fallback,
          skill,
          "guided_practice",
          "This skill has practice available."
        );
      }
    }
    return makeDecision(
      input,
      "complete",
      undefined,
      undefined,
      "session_goal_met",
      "No practice items remain for the current path."
    );
  }

  return makeDecision(
    input,
    choice.action,
    item,
    target,
    choice.reasonCode,
    choice.reason
  );
}

export function diagnoseDecisions(input: PolicyInput, maxItems = 5): Decision[] {
  const { pack, state } = input;
  const ordered = orderedSkills(pack).filter((skill) => !skill.deprecated);
  const goals = input.session.goalSkillIds?.length
    ? ordered.filter((skill) => input.session.goalSkillIds?.includes(skill.id))
    : ordered;
  const targets = goals
    .filter((skill) => masteryOf(state, skill.id) < thresholdFor(skill, pack))
    .slice(0, maxItems);

  const decisions: Decision[] = [];
  for (const skill of targets) {
    const item = selectItem(pack, skill.id, "diagnose", masteryOf(state, skill.id));
    if (!item) continue;
    decisions.push(
      makeDecision(
        input,
        "diagnose",
        item,
        skill,
        "low_mastery",
        "Probe this skill to place you."
      )
    );
  }
  return decisions;
}

export function reviewQueueFor(
  pack: ContentPack,
  state: LearnerState,
  now: Date
): ReviewItem[] {
  return orderedSkills(pack)
    .map((skill) => ({ skill, itemState: state.skills[skill.id] }))
    .filter(
      (entry): entry is { skill: Skill; itemState: SkillState } =>
        Boolean(entry.itemState && isReviewDue(entry.itemState, now))
    )
    .sort(
      (a, b) =>
        overdueDays(b.itemState, now) - overdueDays(a.itemState, now)
    )
    .map((entry) => {
      const item = selectItem(pack, entry.skill.id, "review", entry.itemState.mastery);
      return {
        skillId: entry.skill.id,
        itemId: item?.id,
        dueAt: entry.itemState.nextReviewAt,
        overdueDays: overdueDays(entry.itemState, now),
        mastery: entry.itemState.mastery,
      };
    });
}

export function isPracticeItem(item: Item): boolean {
  return PRACTICE_TYPES.has(item.type);
}
