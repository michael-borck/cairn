import { validatePack, type ContentPack, type Item } from "@cairn/content";

import {
  applyEvidence,
  DEFAULT_BKT_PARAMS,
  evidenceWeight,
  observedCorrectness,
  updateElo,
} from "./bkt";
import {
  chooseNextDecision,
  diagnoseDecisions,
  difficultyBias,
  helpLevelFor,
  masteryOf,
  reviewQueueFor,
  selectItem,
} from "./policy";
import { earliestReviewAt, scheduleReview } from "./review";
import {
  DEFAULT_PREFERENCES,
  ENGINE_VERSION,
  type AdaptiveEngine,
  type Decision,
  type DecisionAction,
  type EngineConfig,
  type EvidenceEvent,
  type LearnerExport,
  type LearnerId,
  type LearnerState,
  type OverrideChoice,
  type ReasonCode,
  type RecordResult,
  type SessionContext,
  type SkillState,
} from "./types";

function blankSkill(): SkillState {
  return {
    mastery: DEFAULT_BKT_PARAMS.prior,
    confidence: 0,
    attempts: 0,
    correct: 0,
    reviewIntervalDays: 0,
    misconceptions: {},
    difficultyElo: 1000,
    consecutiveWrong: 0,
    consecutiveCorrect: 0,
  };
}

export function createInitialState(
  pack: ContentPack,
  learnerId: LearnerId
): LearnerState {
  const skills: Record<string, SkillState> = {};
  for (const skill of pack.curriculum.skills) {
    skills[skill.id] = blankSkill();
  }
  return {
    learnerId,
    packId: pack.manifest.id,
    skills,
    preferences: { ...DEFAULT_PREFERENCES },
    calibration: {
      answered: 0,
      brierScore: 0,
      confidentWrong: 0,
      unsureCorrect: 0,
    },
    history: {
      sessions: 0,
      totalMinutes: 0,
      recentItemIds: [],
    },
  };
}

function defaultId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function decisionForItem(
  pack: ContentPack,
  state: LearnerState,
  item: Item,
  skillId: string,
  action: DecisionAction,
  reasonCode: ReasonCode,
  reason: string,
  now: Date,
  idFactory: () => string
): Decision {
  const skill = pack.curriculum.skills.find((entry) => entry.id === skillId);
  const mastery = masteryOf(state, skillId);
  return {
    id: idFactory(),
    learnerId: state.learnerId,
    action,
    itemId: item.id,
    skillIds: [skillId],
    reasonCode,
    reason: skill ? `${reason} (${skill.title})` : reason,
    evidence: [`skill=${skillId}`, `mastery=${mastery.toFixed(2)}`],
    confidence: mastery,
    helpLevel: helpLevelFor(
      state,
      mastery,
      state.skills[skillId]?.consecutiveWrong ?? 0
    ),
    alternatives: [],
    packVersion: pack.manifest.version,
    policyVersion: pack.policy.id,
    engineVersion: ENGINE_VERSION,
    createdAt: now.toISOString(),
  };
}

export function createEngine(config: EngineConfig): AdaptiveEngine {
  const initial = validatePack(config.pack);
  if (!initial.ok || !initial.pack) {
    throw new Error(`Invalid content pack: ${initial.errors.join("; ")}`);
  }
  let pack = initial.pack;
  const storage = config.storage;
  const now = config.now ?? (() => new Date());
  const idFactory = config.idFactory ?? defaultId;

  async function ensureState(learnerId: LearnerId): Promise<LearnerState> {
    const existing = await storage.loadLearner(learnerId);
    if (existing && existing.packId === pack.manifest.id) {
      if (!Array.isArray(existing.history.recentItemIds)) {
        existing.history.recentItemIds = [];
      }
      return existing;
    }
    const state = createInitialState(pack, learnerId);
    await storage.saveLearner(state);
    return state;
  }

  function sessionFor(state: LearnerState, goalSkillIds?: string[]): SessionContext {
    return {
      goalSkillIds,
      availableMinutes: state.preferences.sessionMinutes,
      mode: state.preferences.pathMode,
    };
  }

  return {
    async loadPack(nextPack) {
      const result = validatePack(nextPack);
      if (!result.ok || !result.pack) {
        throw new Error(`Invalid content pack: ${result.errors.join("; ")}`);
      }
      pack = result.pack;
    },

    async diagnose(input) {
      const state = await ensureState(input.learnerId);
      const decisions = diagnoseDecisions(
        {
          pack,
          state,
          session: sessionFor(state, input.goalSkillIds),
          now: now(),
          idFactory,
        },
        input.maxItems ?? 5
      );
      const result =
        decisions.length > 0
          ? decisions
          : [
              chooseNextDecision({
                pack,
                state,
                session: sessionFor(state, input.goalSkillIds),
                now: now(),
                idFactory,
              }),
            ];
      for (const decision of result) await storage.saveDecision(decision);
      return result;
    },

    async next(input) {
      const state = await ensureState(input.learnerId);
      const decision = chooseNextDecision({
        pack,
        state,
        session: input.session,
        now: now(),
        idFactory,
      });
      await storage.saveDecision(decision);
      return decision;
    },

    async challenge(input) {
      const state = await ensureState(input.learnerId);
      const skill = pack.curriculum.skills.find(
        (entry) => entry.id === input.skillId
      );
      if (!skill) throw new Error(`Unknown skill ${input.skillId}`);
      const item = selectItem(
        pack,
        skill.id,
        "challenge",
        masteryOf(state, skill.id),
        state.history.recentItemIds,
        difficultyBias(state)
      );
      if (!item) throw new Error(`No challenge item for ${skill.title}`);
      const decision = decisionForItem(
        pack,
        state,
        item,
        skill.id,
        "challenge",
        "learner_override",
        "You asked for an optional challenge.",
        now(),
        idFactory
      );
      await storage.saveDecision(decision);
      return decision;
    },

    async record(event: EvidenceEvent): Promise<RecordResult> {
      const state = await ensureState(event.learnerId);
      const item = pack.items.find((entry) => entry.id === event.itemId);
      const skillIds =
        event.skillIds.length > 0 ? event.skillIds : (item?.skillIds ?? []);
      const observed = observedCorrectness(event.correct, event.score);
      const weight = evidenceWeight({
        hintsUsed: event.hintsUsed,
        attempts: event.attempts,
        evidenceSource: event.evidenceSource,
        score: event.score,
      });
      const misconceptionIds = new Set(event.misconceptionIds ?? []);
      if (observed === false) {
        for (const misconceptionId of item?.misconceptionIds ?? []) {
          misconceptionIds.add(misconceptionId);
        }
      }

      for (const skillId of skillIds) {
        const skillState = state.skills[skillId] ?? blankSkill();
        skillState.attempts += 1;
        skillState.lastSeenAt = event.timestamp;

        if (observed !== undefined) {
          if (observed) skillState.correct += 1;
          skillState.mastery = applyEvidence(
            skillState.mastery,
            observed,
            weight
          );
          skillState.consecutiveWrong = observed
            ? 0
            : skillState.consecutiveWrong + 1;
          skillState.consecutiveCorrect = observed
            ? skillState.consecutiveCorrect + 1
            : 0;
          skillState.difficultyElo = updateElo(
            skillState.difficultyElo,
            item?.difficulty ?? 3,
            observed
          );
          const schedule = scheduleReview(
            skillState,
            observed,
            now(),
            pack.policy.reviewIntervalsDays
          );
          skillState.reviewIntervalDays = schedule.reviewIntervalDays;
          skillState.nextReviewAt = schedule.nextReviewAt;
        }

        skillState.confidence = Math.min(
          1,
          skillState.attempts / 5
        );
        for (const misconceptionId of misconceptionIds) {
          skillState.misconceptions[misconceptionId] =
            (skillState.misconceptions[misconceptionId] ?? 0) + 1;
        }
        state.skills[skillId] = skillState;
      }

      if (event.confidence && observed !== undefined) {
        const probability =
          event.confidence === "sure"
            ? 0.95
            : event.confidence === "unsure"
              ? 0.65
              : 0.33;
        const actual = observed ? 1 : 0;
        const brier = (probability - actual) ** 2;
        const answered = state.calibration.answered + 1;
        state.calibration.brierScore =
          (state.calibration.brierScore * state.calibration.answered + brier) /
          answered;
        state.calibration.answered = answered;
        if (event.confidence === "sure" && !observed) {
          state.calibration.confidentWrong += 1;
        }
        if (
          (event.confidence === "guess" || event.confidence === "unsure") &&
          observed
        ) {
          state.calibration.unsureCorrect += 1;
        }
      }

      state.history.lastSessionAt = event.timestamp;
      state.history.recentItemIds = [
        event.itemId,
        ...state.history.recentItemIds.filter((id) => id !== event.itemId),
      ].slice(0, 12);
      await storage.saveLearner(state);
      await storage.appendEvent(event);

      return {
        state,
        misconceptionIds: [...misconceptionIds],
        reviewDueAt: earliestReviewAt(Object.values(state.skills)),
      };
    },

    async explain(decisionId) {
      const decision = await storage.loadDecision(decisionId);
      if (!decision) throw new Error(`Unknown decision ${decisionId}`);
      return {
        decisionId,
        short: decision.reason,
        detailed: `${decision.reason} Evidence: ${decision.evidence.join(", ")}.`,
        evidence: decision.evidence,
        policyVersion: decision.policyVersion,
      };
    },

    async override(input) {
      const state = await ensureState(input.learnerId);
      const decision = await storage.loadDecision(input.decisionId);
      if (!decision) throw new Error(`Unknown decision ${input.decisionId}`);
      const choice: OverrideChoice = input.choice;

      if (
        choice.type === "easier" ||
        choice.type === "harder" ||
        choice.type === "more_help" ||
        choice.type === "less_help"
      ) {
        if (choice.type === "easier") state.preferences.difficulty = "gentle";
        if (choice.type === "harder") state.preferences.difficulty = "challenge";
        if (choice.type === "more_help") state.preferences.help = "walkthrough";
        if (choice.type === "less_help") state.preferences.help = "none";
        await storage.saveLearner(state);
        const next = chooseNextDecision({
          pack,
          state,
          session: sessionFor(state, decision.skillIds),
          now: now(),
          idFactory,
        });
        await storage.saveDecision(next);
        return next;
      }

      if (choice.type === "skip" || choice.type === "review") {
        const skillId = choice.skillIds[0] ?? decision.skillIds[0];
        if (!skillId) throw new Error("No skill selected for the override");
        const action: DecisionAction =
          choice.type === "skip" ? "challenge" : "review";
        const item = selectItem(
          pack,
          skillId,
          action,
          masteryOf(state, skillId),
          state.history.recentItemIds,
          difficultyBias(state)
        );
        if (!item) {
          const next = chooseNextDecision({
            pack,
            state,
            session: sessionFor(state, [skillId]),
            now: now(),
            idFactory,
          });
          await storage.saveDecision(next);
          return next;
        }
        const overridden = decisionForItem(
          pack,
          state,
          item,
          skillId,
          action,
          "learner_override",
          choice.type === "skip"
            ? "You asked to test out of this skill."
            : "You asked to review this skill.",
          now(),
          idFactory
        );
        await storage.saveDecision(overridden);
        return overridden;
      }

      const item = pack.items.find((entry) => entry.id === choice.itemId);
      if (!item) throw new Error(`Unknown item ${choice.itemId}`);
      const skillId = item.skillIds[0];
      if (!skillId) throw new Error(`Item ${item.id} has no skill`);
      const overridden = decisionForItem(
        pack,
        state,
        item,
        skillId,
        "practice",
        "learner_override",
        "You chose this item.",
        now(),
        idFactory
      );
      await storage.saveDecision(overridden);
      return overridden;
    },

    async reviewQueue(learnerId) {
      const state = await ensureState(learnerId);
      return reviewQueueFor(pack, state, now());
    },

    async getState(learnerId) {
      return ensureState(learnerId);
    },

    async exportLearner(learnerId): Promise<LearnerExport> {
      const state = await ensureState(learnerId);
      return {
        schemaVersion: "0.1",
        exportedAt: now().toISOString(),
        state,
      };
    },

    async importLearner(data) {
      if (data.schemaVersion !== "0.1") {
        throw new Error(`Unsupported learner export ${data.schemaVersion}`);
      }
      await storage.saveLearner(data.state);
      return data.state;
    },
  };
}
