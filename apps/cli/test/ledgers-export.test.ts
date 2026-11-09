import { describe, expect, it } from "vitest";

import { toLedgersBundle } from "../src/ledgers-export";
import { validPack } from "../../../packages/content/test/fixtures";

describe("toLedgersBundle", () => {
  it("maps a Cairn export to a Ledgers bundle", () => {
    const bundle = toLedgersBundle({
      schemaVersion: "0.1",
      exportedAt: "2026-11-09T00:00:00.000Z",
      pack: validPack as any,
      model: { bkt: { prior: 0.3 } },
      policy: { id: "default-v1" },
      events: [
        {
          learnerId: "learner-1",
          itemId: "container-mcq",
          timestamp: "2026-11-09T00:00:00.000Z",
          correct: true,
          hintsUsed: 0,
          attempts: 1,
          confidence: "sure",
          durationMs: 4200,
          decisionId: "decision-1",
        },
        {
          learnerId: "learner-1",
          itemId: "port-worked",
          timestamp: "2026-11-09T00:05:00.000Z",
          score: 0.7,
          hintsUsed: 1,
          attempts: 1,
          durationMs: 5000,
        },
      ],
    });

    expect(bundle.skills).toHaveLength(2);
    expect(bundle.items).toHaveLength(5);
    expect(bundle.attempts).toHaveLength(2);
    expect(bundle.items.find((item) => item.id === "port-worked")?.kind).toBe(
      "worked"
    );
    expect(
      bundle.items.find((item) => item.id === "container-mcq")?.authorDifficulty
    ).toBe(-1);
    expect(bundle.attempts[0].confidence).toBe(0.95);
    expect(bundle.attempts[1].correct).toBe(true);
    expect(bundle.attempts[0].decisionId).toBe("decision-1");
    expect(bundle.meta.packId).toBe("docker-fundamentals");
    expect(bundle.meta.note).toContain("policy comparison");
  });
});
