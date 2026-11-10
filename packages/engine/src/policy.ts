import type {
  ContentPack,
  Item,
  Scaffold,
  Skill,
  SkillId,
} from "@cairn/content";

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

const READINESS_THRESHOLD = 0.6;
const MIN_DWELL = 2;
const MAX_DWELL = 8;

export function thresholdFor(skill: Skill, pack: ContentPack): number {
  return skill.masteryThreshold ?? pack.policy.masteryThreshold;
}

export function isMastered(
  skill: Skill,
  state: LearnerState,
  pack: ContentPack
): boolean {
  const skillState = state.skills[skill.id];
  if (!skillState) return false;
  return (
    skillState.mastery >= thresholdFor(skill, pack) &&
    skillState.evidenceCount >= 8 &&
    skillState.hardPasses >= 1 &&
    skillState.delayedPasses >= 1
  );
}

function reviewCapReached(state: LearnerState, pack: ContentPack): boolean {
  const items = state.session?.items ?? 0;
  const reviews = state.session?.reviewItems ?? 0;
  return items >= 4 && reviews / items >= (pack.policy.reviewCap ?? 0.5);
}

export function difficultyBias(state: LearnerState): number {
  if (state.preferences.difficulty === "gentle") return -1;
  if (state.preferences.difficulty === "challenge") return 1;
  return 0;
}

export function helpLevelFor(
  state: LearnerState,
  mastery: number,
  consecutiveWrong: number
): number {
  const preference = state.preferences.help;
  if (preference === "none") return 0;
  if (preference === "nudge") return 1;
  if (preference === "hint") return 2;
  if (preference === "walkthrough") return 3;
  if (consecutiveWrong >= 4) return 4;
  if (consecutiveWrong >= 2 || mastery < 0.4) return 2;
  if (mastery < 0.7) return 1;
  return 0;
}

function prerequisitesMet(
  skill: Skill,
  state: LearnerState,
  pack: ContentPack
): boolean {
  return (skill.prerequisites ?? []).every((id) => {
    const prerequisite = pack.curriculum.skills.find((item) => item.id === id);
    return (
      masteryOf(state, id) >=
      (prerequisite ? READINESS_THRESHOLD : READINESS_THRESHOLD)
    );
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
    if (masteryOf(state, id) < READINESS_THRESHOLD) {
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
  scaffold: [
    "explain",
    "worked_example",
    "mcq",
    "short_answer",
    "teach_back",
    "lab",
    "reflection",
  ],
  complete: [],
};

function pickItem(
  candidates: Item[],
  action: DecisionAction,
  mastery: number,
  recentItemIds: string[],
  difficultyOffset: number
): Item | undefined {
  if (candidates.length === 0) return undefined;

  const order = TYPE_ORDER[action];
  const preferred = candidates.filter((item) => order.includes(item.type));
  const pool = preferred.length > 0 ? preferred : candidates;
  const fresh = pool.filter((item) => !recentItemIds.includes(item.id));
  const items = fresh.length > 0 ? fresh : pool;
  const targetDifficulty = Math.min(
    5,
    Math.max(1, 1 + mastery * 4 + difficultyOffset)
  );

  return [...items].sort((a, b) => {
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

export function selectItem(
  pack: ContentPack,
  skillId: SkillId,
  action: DecisionAction,
  mastery: number,
  recentItemIds: string[] = [],
  difficultyOffset = 0
): Item | undefined {
  return pickItem(
    itemsForSkill(pack, skillId),
    action,
    mastery,
    recentItemIds,
    difficultyOffset
  );
}

function selectScaffoldParent(
  pack: ContentPack,
  skillId: SkillId,
  mastery: number,
  recentItemIds: string[] = [],
  difficultyOffset = 0
): Item | undefined {
  return pickItem(
    itemsForSkill(pack, skillId).filter(
      (item) => (item.scaffolds ?? []).length > 0
    ),
    "scaffold",
    mastery,
    recentItemIds,
    difficultyOffset
  );
}

interface ScaffoldChoice {
  scaffold: Scaffold;
  path: string[];
}

function chooseScaffold(
  itemId: string,
  scaffolds: Scaffold[],
  state: LearnerState,
  path: string[] = []
): ScaffoldChoice | undefined {
  for (const scaffold of scaffolds) {
    const key = `${itemId}::${scaffold.id}`;
    const progress = state.scaffolds?.[key];
    const nodePath = [...path, scaffold.id];
    if (!progress?.attempts) {
      return { scaffold, path: nodePath };
    }
    if (progress.consecutiveWrong > 0) {
      const child = chooseScaffold(
        itemId,
        scaffold.scaffolds ?? [],
        state,
        nodePath
      );
      if (child) return child;
    }
  }
  return undefined;
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
    const item = selectItem(
      pack,
      entry.skill.id,
      "review",
      entry.itemState.mastery,
      state.history.recentItemIds,
      difficultyBias(state)
    );
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
  const session = state.session;
  const current = session?.currentSkillId
    ? pool.find((skill) => skill.id === session.currentSkillId)
    : undefined;
  if (
    current &&
    !isMastered(current, state, pack) &&
    prerequisitesMet(current, state, pack) &&
    (session?.dwell ?? 0) < MIN_DWELL
  ) {
    return current;
  }

  const unmastered = pool.filter(
    (skill) =>
      !isMastered(skill, state, pack) &&
      !(
        session?.dwell >= MAX_DWELL &&
        skill.id === session.currentSkillId
      )
  );
  const ready = unmastered.find((skill) => prerequisitesMet(skill, state, pack));
  if (ready) return ready;
  if (unmastered.length > 0) return unmastered[0];
  if (current && !isMastered(current, state, pack)) return current;
  return undefined;
}

function actionForMastery(
  mastery: number,
  threshold: number,
  consecutiveWrong: number,
  gateMet: boolean
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
  if (!gateMet) {
    return {
      action: "practice",
      reasonCode: "independent_practice",
      reason:
        "Mastery is high. Collect a hard item and a delayed success before review.",
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
  reason: string,
  scaffold?: ScaffoldChoice
): Decision {
  const state = input.state;
  const mastery = skill ? masteryOf(state, skill.id) : 0;
  const baseHelpLevel = skill
    ? helpLevelFor(state, mastery, state.skills[skill.id]?.consecutiveWrong ?? 0)
    : 0;
  const helpLevel =
    action === "scaffold" ? Math.max(3, baseHelpLevel) : baseHelpLevel;
  const evidence = skill
    ? [
        `skill=${skill.id}`,
        `mastery=${mastery.toFixed(2)}`,
        `threshold=${thresholdFor(skill, input.pack).toFixed(2)}`,
        `attempts=${state.skills[skill.id]?.attempts ?? 0}`,
        `evidence=${(state.skills[skill.id]?.evidenceCount ?? 0).toFixed(1)}`,
      ]
    : ["all skills mastered"];
  if (scaffold) {
    evidence.push(`scaffold=${scaffold.path.join(".")}`);
    if (item) evidence.push(`parent=${item.id}`);
  }
  return {
    id: input.idFactory(),
    learnerId: state.learnerId,
    action,
    itemId: item?.id,
    scaffoldId: scaffold?.scaffold.id,
    scaffoldPath: scaffold?.path,
    skillIds: skill ? [skill.id] : [],
    reasonCode,
    reason: skill ? `${reason} (${skill.title})` : reason,
    evidence,
    confidence: mastery,
    helpLevel,
    alternatives: [],
    packVersion: input.pack.manifest.version,
    policyVersion: input.pack.policy.id,
    engineVersion: ENGINE_VERSION,
    createdAt: input.now.toISOString(),
  };
}

export function chooseNextDecision(input: PolicyInput): Decision {
  const { pack, state, now } = input;
  const bias = difficultyBias(state);
  const review = dueReview(pack, state, now);
  if (review && !reviewCapReached(state, pack)) {
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
    const item = selectItem(
      pack,
      gap.id,
      "remediate",
      masteryOf(state, gap.id),
      state.history.recentItemIds,
      bias
    );
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

  if (consecutiveWrong >= pack.policy.wrongStreak.switchRepresentation) {
    const parent = selectScaffoldParent(
      pack,
      target.id,
      mastery,
      state.history.recentItemIds,
      bias
    );
    if (parent) {
      const scaffold = chooseScaffold(
        parent.id,
        parent.scaffolds ?? [],
        state
      );
      if (scaffold) {
        return makeDecision(
          input,
          "scaffold",
          parent,
          target,
          "scaffold_step",
          "A smaller step can help here.",
          scaffold
        );
      }
    }
  }

  if (consecutiveWrong >= pack.policy.wrongStreak.prerequisite) {
    const item = selectItem(
      pack,
      target.id,
      "remediate",
      mastery,
      state.history.recentItemIds,
      bias
    );
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

  let choice = actionForMastery(
    mastery,
    threshold,
    consecutiveWrong,
    isMastered(target, state, pack)
  );
  let item = selectItem(
    pack,
    target.id,
    choice.action,
    mastery,
    state.history.recentItemIds,
    bias
  );
  if (
    item &&
    (choice.action === "explain" || choice.action === "worked_example") &&
    state.history.recentItemIds.includes(item.id)
  ) {
    const practice = selectItem(
      pack,
      target.id,
      "practice",
      mastery,
      state.history.recentItemIds,
      bias
    );
    if (practice) {
      item = practice;
      choice = {
        action: "practice",
        reasonCode: "guided_practice",
        reason: "You have seen the explanation. Move to practice.",
      };
    }
  }
  if (!item) {
    item = selectItem(
      pack,
      target.id,
      "practice",
      mastery,
      state.history.recentItemIds,
      bias
    );
  }
  if (!item) {
    for (const skill of orderedSkills(pack)) {
      if (skill.deprecated) continue;
      if (masteryOf(state, skill.id) >= thresholdFor(skill, pack)) continue;
      const fallback = selectItem(
        pack,
        skill.id,
        "practice",
        masteryOf(state, skill.id),
        state.history.recentItemIds,
        bias
      );
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
    .filter((skill) => !isMastered(skill, state, pack))
    .slice(0, maxItems);

  const decisions: Decision[] = [];
  for (const skill of targets) {
    const item = selectItem(
      pack,
      skill.id,
      "diagnose",
      masteryOf(state, skill.id),
      state.history.recentItemIds,
      difficultyBias(state)
    );
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
      const item = selectItem(
      pack,
      entry.skill.id,
      "review",
      entry.itemState.mastery,
      state.history.recentItemIds,
      difficultyBias(state)
    );
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
