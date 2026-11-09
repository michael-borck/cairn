import { describe, expect, it } from "vitest";

import type { ContentPack } from "@cairn/content";

import {
  applyEvidence,
  chooseNextDecision,
  createEngine,
  createInitialState,
  createMemoryStorage,
  evidenceWeight,
  helpLevelFor,
  isMastered,
  scheduleReview,
  selectItem,
  updateMastery,
} from "../src";
import { validPack } from "../../content/test/fixtures";

const pack = validPack as unknown as ContentPack;
const now = new Date("2026-01-01T00:00:00.000Z");

function clone<T>(value: T): T {
  return structuredClone(value);
}

function decisionInput(state = createInitialState(pack, "learner-1")) {
  return {
    pack,
    state,
    session: {
      availableMinutes: 25,
      mode: "auto" as const,
    },
    now,
    idFactory: () => "decision-1",
  };
}

describe("BKT-lite", () => {
  it("moves mastery in the right direction", () => {
    expect(updateMastery(0.3, true)).toBeGreaterThan(0.3);
    expect(updateMastery(0.3, false)).toBeLessThan(0.3);
  });

  it("supports partial evidence weight", () => {
    const full = updateMastery(0.5, true);
    const weighted = applyEvidence(0.5, true, 0.5);
    expect(weighted).toBeGreaterThan(0.5);
    expect(weighted).toBeLessThan(full);
    expect(applyEvidence(0.5, true, 0)).toBe(0.5);
  });

  it("discounts hints and self-report", () => {
    expect(
      evidenceWeight({
        hintsUsed: 1,
        attempts: 1,
        evidenceSource: "learner",
      })
    ).toBeLessThan(1);
    expect(
      evidenceWeight({
        hintsUsed: 0,
        attempts: 1,
        evidenceSource: "self",
      })
    ).toBeLessThan(0.2);
  });
});

describe("review scheduling", () => {
  it("moves through intervals and steps back after a miss", () => {
    const state = createInitialState(pack, "learner-1").skills["container-basics"];
    const first = scheduleReview(state, true, now, [1, 3, 7]);
    expect(first.reviewIntervalDays).toBe(1);

    const second = scheduleReview(
      { ...state, reviewIntervalDays: 1 },
      true,
      now,
      [1, 3, 7]
    );
    expect(second.reviewIntervalDays).toBe(3);

    const missed = scheduleReview(
      { ...state, reviewIntervalDays: 7 },
      false,
      now,
      [1, 3, 7]
    );
    expect(missed.reviewIntervalDays).toBe(3);
  });
});

describe("policy", () => {
  it("starts a new skill with an explanation", () => {
    const decision = chooseNextDecision(decisionInput());
    expect(decision.action).toBe("explain");
    expect(decision.itemId).toBe("container-explain");
    expect(decision.reasonCode).toBe("low_mastery");
  });

  it("prioritises a due review", () => {
    const state = createInitialState(pack, "learner-1");
    state.skills["container-basics"].mastery = 0.5;
    state.skills["container-basics"].nextReviewAt = "2025-12-30T00:00:00.000Z";
    const decision = chooseNextDecision(decisionInput(state));
    expect(decision.action).toBe("review");
    expect(decision.reasonCode).toBe("review_due");
  });

  it("avoids recently seen items when alternatives exist", () => {
    const custom = clone(pack) as any;
    custom.items.push({
      ...custom.items[1],
      id: "container-mcq-2",
      prompt: "Which command lists images?",
    });
    const chosen = selectItem(
      custom,
      "container-basics",
      "practice",
      0.5,
      ["container-mcq"]
    );
    expect(chosen?.id).toBe("container-mcq-2");
  });

  it("changes item difficulty with the difficulty preference", () => {
    const custom = clone(pack) as any;
    custom.items.push({
      ...custom.items[1],
      id: "easy-mcq",
      difficulty: 1,
      prompt: "Easy item",
    });
    custom.items.push({
      ...custom.items[1],
      id: "hard-mcq",
      difficulty: 5,
      prompt: "Hard item",
    });
    const easy = selectItem(
      custom,
      "container-basics",
      "practice",
      0.5,
      [],
      -1
    );
    const hard = selectItem(
      custom,
      "container-basics",
      "practice",
      0.5,
      [],
      1
    );
    expect(easy?.difficulty).toBeLessThan(hard?.difficulty ?? 0);
  });

  it("computes help level from preference and wrong streak", () => {
    const state = createInitialState(pack, "learner-1");
    state.preferences.help = "none";
    expect(helpLevelFor(state, 0.2, 3)).toBe(0);
    state.preferences.help = "walkthrough";
    expect(helpLevelFor(state, 0.2, 3)).toBe(3);
    state.preferences.help = "auto";
    expect(helpLevelFor(state, 0.2, 0)).toBe(2);
    expect(helpLevelFor(state, 0.5, 0)).toBe(1);
    expect(helpLevelFor(state, 0.8, 0)).toBe(0);
    expect(helpLevelFor(state, 0.8, 4)).toBe(4);
  });

  it("requires evidence and retention passes for mastery", () => {
    const state = createInitialState(pack, "learner-1");
    const skill = pack.curriculum.skills[0];
    const skillState = state.skills[skill.id];
    skillState.mastery = 0.95;
    skillState.evidenceCount = 2;
    skillState.hardPasses = 0;
    skillState.delayedPasses = 0;
    expect(isMastered(skill, state, pack)).toBe(false);
    skillState.evidenceCount = 8;
    skillState.hardPasses = 1;
    skillState.delayedPasses = 1;
    expect(isMastered(skill, state, pack)).toBe(true);
  });

  it("caps review once the session review share is reached", () => {
    const state = createInitialState(pack, "learner-1");
    const skillState = state.skills["container-basics"];
    skillState.mastery = 0.5;
    skillState.evidenceCount = 3;
    skillState.halfLifeDays = 3;
    skillState.lastSeenAt = "2025-12-20T00:00:00.000Z";
    skillState.nextReviewAt = "2025-12-21T00:00:00.000Z";
    state.session = {
      items: 10,
      reviewItems: 6,
      dwell: 0,
      currentSkillId: "container-basics",
      lastAt: now.toISOString(),
    };
    const decision = chooseNextDecision(decisionInput(state));
    expect(decision.action).not.toBe("review");
  });

  it("updates evidence, half-life, and retention review after an attempt", async () => {
    const engine = createEngine({
      pack,
      storage: createMemoryStorage(),
      now: () => now,
      idFactory: () => "decision-1",
    });
    await engine.record({
      id: "event-1",
      learnerId: "learner-1",
      packId: pack.manifest.id,
      packVersion: pack.manifest.version,
      itemId: "container-explain",
      skillIds: ["container-basics"],
      timestamp: now.toISOString(),
      response: "read",
      correct: true,
      hintsUsed: 0,
      attempts: 1,
      durationMs: 1000,
      evidenceSource: "learner",
      action: "explain",
    });
    const second = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    await engine.record({
      id: "event-2",
      learnerId: "learner-1",
      packId: pack.manifest.id,
      packVersion: pack.manifest.version,
      itemId: "container-mcq",
      skillIds: ["container-basics"],
      timestamp: second.toISOString(),
      response: "a",
      correct: true,
      hintsUsed: 0,
      attempts: 1,
      durationMs: 1000,
      evidenceSource: "learner",
      action: "practice",
    });
    const state = await engine.getState("learner-1");
    const skillState = state.skills["container-basics"];
    expect(skillState.evidenceCount).toBeGreaterThan(0);
    expect(skillState.halfLifeDays).toBeGreaterThan(3);
    expect(skillState.delayedPasses).toBe(1);
    expect(skillState.nextReviewAt).toBeTruthy();
    expect(state.session.items).toBe(1);
  });

  it("applies the more-help override to the next decision", async () => {
    const engine = createEngine({
      pack,
      storage: createMemoryStorage(),
      now: () => now,
      idFactory: () => "decision-1",
    });
    const first = await engine.next({
      learnerId: "learner-1",
      session: { availableMinutes: 25, mode: "auto" },
    });
    const next = await engine.override({
      learnerId: "learner-1",
      decisionId: first.id,
      choice: { type: "more_help" },
    });
    expect(next.helpLevel).toBe(3);
    const state = await engine.getState("learner-1");
    expect(state.preferences.help).toBe("walkthrough");
  });

  it("steps back to a prerequisite when one is weak", () => {
    const state = createInitialState(pack, "learner-1");
    state.skills["container-basics"].mastery = 0.4;
    state.skills["port-mapping"].mastery = 0.2;
    const decision = chooseNextDecision({
      ...decisionInput(state),
      session: {
        goalSkillIds: ["port-mapping"],
        availableMinutes: 25,
        mode: "auto",
      },
    });
    expect(decision.action).toBe("remediate");
    expect(decision.reasonCode).toBe("prerequisite_gap");
    expect(decision.skillIds).toEqual(["container-basics"]);
  });
});

describe("engine", () => {
  it("creates a state, returns a decision, records evidence, and explains it", async () => {
    const engine = createEngine({
      pack,
      storage: createMemoryStorage(),
      now: () => now,
      idFactory: () => "decision-1",
    });

    const decision = await engine.next({
      learnerId: "learner-1",
      session: { availableMinutes: 25, mode: "auto" },
    });
    expect(decision.action).toBe("explain");

    const before = await engine.getState("learner-1");
    const result = await engine.record({
      id: "event-1",
      learnerId: "learner-1",
      packId: pack.manifest.id,
      packVersion: pack.manifest.version,
      itemId: "container-explain",
      skillIds: ["container-basics"],
      timestamp: now.toISOString(),
      response: "read",
      correct: true,
      hintsUsed: 0,
      attempts: 1,
      durationMs: 1000,
      evidenceSource: "learner",
    });
    expect(result.state.skills["container-basics"].mastery).toBeGreaterThan(
      before.skills["container-basics"].mastery
    );
    expect(result.state.history.recentItemIds[0]).toBe("container-explain");

    const explanation = await engine.explain(decision.id);
    expect(explanation.short).toContain("Start with an explanation");
    expect(explanation.evidence.some((entry) => entry.startsWith("skill="))).toBe(true);
  });

  it("returns a challenge decision for a known skill", async () => {
    const engine = createEngine({
      pack,
      storage: createMemoryStorage(),
      now: () => now,
      idFactory: () => "challenge-1",
    });
    const decision = await engine.challenge({
      learnerId: "learner-1",
      skillId: "container-basics",
    });
    expect(decision.action).toBe("challenge");
    expect(decision.itemId).toBeTruthy();
    expect(decision.skillIds).toEqual(["container-basics"]);
  });

  it("exports and imports learner state", async () => {
    const engine = createEngine({
      pack,
      storage: createMemoryStorage(),
      now: () => now,
      idFactory: () => "decision-1",
    });
    await engine.getState("learner-1");
    const exported = await engine.exportLearner("learner-1");
    const imported = await engine.importLearner(exported);
    expect(imported.learnerId).toBe("learner-1");
    expect(imported.packId).toBe(pack.manifest.id);
  });
});
