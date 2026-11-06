import { describe, expect, it } from "vitest";

import { validatePack } from "../src";
import { validPack } from "./fixtures";

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe("validatePack", () => {
  it("accepts a valid pack", () => {
    const result = validatePack(validPack);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.pack?.items.length).toBe(5);
  });

  it("reports schema errors with paths", () => {
    const pack = clone(validPack) as any;
    pack.manifest.version = "one";
    const result = validatePack(pack);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.startsWith("manifest.version"))).toBe(
      true
    );
  });

  it("reports duplicate skill ids", () => {
    const pack = clone(validPack) as any;
    pack.curriculum.skills.push({ ...pack.curriculum.skills[0] });
    const result = validatePack(pack);
    expect(result.errors).toContain("curriculum: duplicate skill id container-basics");
  });

  it("reports prerequisite cycles", () => {
    const pack = clone(validPack) as any;
    pack.curriculum.skills[0].prerequisites = ["port-mapping"];
    const result = validatePack(pack);
    expect(result.errors.some((error) => error.includes("prerequisite cycle"))).toBe(
      true
    );
  });

  it("reports unknown skill references", () => {
    const pack = clone(validPack) as any;
    pack.items[0].skillIds = ["missing-skill"];
    const result = validatePack(pack);
    expect(result.errors).toContain("item container-explain: unknown skill missing-skill");
  });

  it("reports a missing correct option", () => {
    const pack = clone(validPack) as any;
    pack.items[1].correctOptionId = "z";
    const result = validatePack(pack);
    expect(result.errors).toContain(
      "item container-mcq: correctOptionId does not match an option"
    );
  });

  it("rejects a level 1 hint that reveals the answer", () => {
    const pack = clone(validPack) as any;
    pack.items[3].hints[0].revealsAnswer = true;
    const result = validatePack(pack);
    expect(result.errors).toContain(
      "item port-mcq: hint level 1 must not reveal the answer"
    );
  });

  it("reports unknown lab references", () => {
    const pack = clone(validPack) as any;
    pack.items[4].labId = "missing-lab";
    const result = validatePack(pack);
    expect(result.errors).toContain("item port-lab: unknown lab missing-lab");
  });

  it("rejects external media paths", () => {
    const pack = clone(validPack) as any;
    pack.items[0].media = [
      { type: "image", path: "https://example.com/a.png", alt: "A" },
    ];
    const result = validatePack(pack);
    expect(result.errors).toContain(
      "item container-explain: media must be local, got https://example.com/a.png"
    );
  });
});
