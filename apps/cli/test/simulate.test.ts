import { describe, expect, it } from "vitest";

import type { ContentPack } from "@cairn/content";

import { simulate } from "../src/simulate";
import { validPack } from "../../../packages/content/test/fixtures";

const pack = validPack as unknown as ContentPack;
const start = new Date("2026-01-01T00:00:00.000Z");

describe("simulate", () => {
  it("is deterministic for a fixed seed and clock", async () => {
    const first = await simulate(pack, {
      learners: 3,
      seed: 1,
      maxSteps: 40,
      start,
    });
    const second = await simulate(pack, {
      learners: 3,
      seed: 1,
      maxSteps: 40,
      start,
    });
    expect(first).toEqual(second);
    expect(first.learners).toBe(3);
    expect(first.averageSteps).toBeGreaterThan(0);
  });

  it("produces different outcomes for a different seed", async () => {
    const first = await simulate(pack, {
      learners: 3,
      seed: 1,
      maxSteps: 40,
      start,
    });
    const second = await simulate(pack, {
      learners: 3,
      seed: 2,
      maxSteps: 40,
      start,
    });
    expect(first).not.toEqual(second);
  });
});
