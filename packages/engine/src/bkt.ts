export interface BktParams {
  prior: number;
  learn: number;
  slip: number;
  guess: number;
}

export const DEFAULT_BKT_PARAMS: BktParams = {
  prior: 0.3,
  learn: 0.15,
  slip: 0.1,
  guess: 0.2,
};

const EPSILON = 1e-9;

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function updateMastery(
  mastery: number,
  correct: boolean,
  params: BktParams = DEFAULT_BKT_PARAMS
): number {
  const known = clamp01(mastery);
  const slip = clamp01(params.slip);
  const guess = clamp01(params.guess);
  const learn = clamp01(params.learn);
  const correctProbability = known * (1 - slip) + (1 - known) * guess;
  const incorrectProbability = known * slip + (1 - known) * (1 - guess);
  const posterior = correct
    ? (known * (1 - slip)) / Math.max(correctProbability, EPSILON)
    : (known * slip) / Math.max(incorrectProbability, EPSILON);
  return clamp01(posterior + (1 - posterior) * learn);
}

export interface EvidenceWeightInput {
  hintsUsed: number;
  attempts: number;
  evidenceSource: "learner" | "ai" | "lab" | "self";
  score?: number;
}

export function evidenceWeight(input: EvidenceWeightInput): number {
  let weight = 1;
  if (input.evidenceSource === "ai") weight = 0.6;
  if (input.evidenceSource === "self") weight = 0.1;
  if (input.hintsUsed > 0) weight = Math.min(weight, 0.6);
  if (input.attempts > 1) weight = Math.min(weight, 0.5);
  if (input.score !== undefined) weight = Math.min(weight, 0.6);
  return clamp01(weight);
}

export function applyEvidence(
  mastery: number,
  correct: boolean,
  weight = 1,
  params: BktParams = DEFAULT_BKT_PARAMS
): number {
  const updated = updateMastery(mastery, correct, params);
  return clamp01(mastery + clamp01(weight) * (updated - mastery));
}

export function observedCorrectness(
  correct: boolean | undefined,
  score: number | undefined
): boolean | undefined {
  if (correct !== undefined) return correct;
  if (score !== undefined) return score >= 0.6;
  return undefined;
}

export function itemDifficultyToElo(difficulty: number): number {
  return 1000 + (difficulty - 3) * 200;
}

export function updateElo(
  learnerElo: number,
  itemDifficulty: number,
  correct: boolean,
  k = 24
): number {
  const expected =
    1 / (1 + 10 ** ((itemDifficultyToElo(itemDifficulty) - learnerElo) / 400));
  return learnerElo + k * ((correct ? 1 : 0) - expected);
}
