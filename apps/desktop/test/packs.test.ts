import { describe, expect, it } from "vitest";

import { isRevoked } from "../src/packs";

describe("catalog revocations", () => {
  it("matches a specific pack version", () => {
    const revocation = {
      id: "docker-fundamentals",
      version: "0.1.0",
      reason: "Bad answer key.",
      revokedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      isRevoked(
        { id: "docker-fundamentals", version: "0.1.0" },
        [revocation]
      )
    ).toBe(revocation);
    expect(
      isRevoked(
        { id: "docker-fundamentals", version: "0.2.0" },
        [revocation]
      )
    ).toBeUndefined();
  });

  it("matches every version when version is omitted", () => {
    const revocation = {
      id: "docker-fundamentals",
      reason: "Withdrawn.",
      revokedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      isRevoked(
        { id: "docker-fundamentals", version: "9.9.9" },
        [revocation]
      )
    ).toBe(revocation);
  });
});
