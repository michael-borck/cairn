import { describe, expect, it } from "vitest";

import type { ContentPack } from "@cairn/content";

import {
  applyEvidence,
  chooseNextDecision,
  createEngine,
  createInitialState,
  createMemoryStorage,
  evidenceWeight,
  scheduleReview,
  updateMastery,
} from "../src";
import { validPack } from "../../content/test/fixtures";

const pack = validPack as unknown as ContentPack;
const now = new Date("2026-01-01T00:00:00.000Z");

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

  it("steps back to a prerequisite when one is weak", () => {
    const state = createInitialState(pack, "learner-1");
    state.skills["container-basics"].mastery = 0.6;
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

    const explanation = await engine.explain(decision.id);
    expect(explanation.short).toContain("Start with an explanation");
    expect(explanation.evidence.some((entry) => entry.startsWith("skill="))).toBe(true);
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
