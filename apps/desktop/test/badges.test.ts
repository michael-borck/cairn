import { describe, expect, it } from "vitest";

import type { ContentPack } from "@cairn/content";
import type { EvidenceEvent, LearnerState } from "@cairn/engine";

import { computeBadges } from "../src/badges";

const pack = {
  items: [
    { id: "mcq", type: "mcq" },
    { id: "teach", type: "teach_back" },
    { id: "lab", type: "lab" },
  ],
  curriculum: { skills: [] },
  policy: {},
} as unknown as ContentPack;

const learner = {
  calibration: {
    answered: 12,
    brierScore: 0.1,
    confidentWrong: 0,
    unsureCorrect: 0,
  },
} as unknown as LearnerState;

function event(overrides: Partial<EvidenceEvent>): EvidenceEvent {
  return {
    id: "event",
    learnerId: "learner",
    packId: "pack",
    packVersion: "1.0.0",
    itemId: "mcq",
    skillIds: ["skill"],
    timestamp: "2026-01-01T00:00:00.000Z",
    response: "",
    correct: true,
    hintsUsed: 0,
    attempts: 1,
    durationMs: 1000,
    evidenceSource: "learner",
    ...overrides,
  };
}

describe("computeBadges", () => {
  it("unlocks badges from evidence", () => {
    const events = [
      event({
        id: "e1",
        correct: false,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
      event({
        id: "e2",
        correct: true,
        timestamp: "2026-01-01T01:00:00.000Z",
      }),
      event({
        id: "e3",
        itemId: "teach",
        hintsUsed: 1,
        timestamp: "2026-01-02T00:00:00.000Z",
      }),
      event({
        id: "e4",
        itemId: "lab",
        timestamp: "2026-01-03T00:00:00.000Z",
      }),
    ];
    const badges = computeBadges(pack, learner, events);
    expect(badges.every((badge) => badge.earned)).toBe(true);
  });

  it("leaves badges locked without evidence", () => {
    const badges = computeBadges(pack, null, []);
    expect(badges.every((badge) => !badge.earned)).toBe(true);
  });
});
