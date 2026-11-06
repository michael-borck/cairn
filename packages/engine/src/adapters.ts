import type { AIAdapter, LabChecker } from "./types";

export function createNoopAI(): AIAdapter {
  return {
    mode: "off",
    async generateHint() {
      throw new Error("AI mode is off");
    },
    async gradeShortAnswer() {
      throw new Error("AI mode is off");
    },
    async generateVariants() {
      throw new Error("AI mode is off");
    },
  };
}

export function createManualLabChecker(): LabChecker {
  return {
    mode: "manual",
    async evaluate() {
      return { passed: false, checks: [] };
    },
  };
}
