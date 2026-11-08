export const MODEL_VERSION = 'ledgers-model-0.1.0';
export const POLICY_VERSION = 'ledgers-policy-0.1.0';

/**
 * Model parameters: things a fit on logs should eventually replace.
 * Defaults are placeholders, not findings.
 */
export interface ModelParams {
  pInit: number;
  learn: number;
  slipBase: number;
  guessBase: number;
  slipPerDifficulty: number;
  guessPerDifficulty: number;
  /** Clamp for slip and guess. With max 0.40 each, slip + guess <= 0.8 so items always discriminate. */
  paramMin: number;
  paramMax: number;
  difficultyMin: number;
  difficultyMax: number;
  halfLifeInitDays: number;
  halfLifeMinDays: number;
  halfLifeMaxDays: number;
  /** Correct, effortful retrieval multiplies half-life by 1 + growth * (1 - R) * share * P(learned|correct). */
  halfLifeGrowth: number;
  /** A forgetting failure multiplies half-life by 1 - (1 - shrink) * forgotBlame. */
  halfLifeShrink: number;
  /** Belief staleness: evidence count halves after this many days without practice. */
  evidenceHalfLifeDays: number;
  /** Pseudo-count for the heuristic Beta interval on L. */
  priorStrength: number;
}

export const DEFAULT_MODEL: ModelParams = {
  pInit: 0.2,
  learn: 0.15,
  slipBase: 0.1,
  guessBase: 0.2,
  slipPerDifficulty: 0.1,
  guessPerDifficulty: 0.1,
  paramMin: 0.02,
  paramMax: 0.4,
  difficultyMin: -2,
  difficultyMax: 2,
  halfLifeInitDays: 2,
  halfLifeMinDays: 0.25,
  halfLifeMaxDays: 180,
  halfLifeGrowth: 1.5,
  halfLifeShrink: 0.5,
  evidenceHalfLifeDays: 30,
  priorStrength: 2,
};

/**
 * Product policy: deliberate choices, not science. Change them on purpose and log the version.
 */
export interface PolicyParams {
  mastery: {
    /** One-sided quantile for the lower bound (0.1 = 90% lower bound). */
    lowerQuantile: number;
    pLowerMin: number;
    nMin: number;
    delayedGapDays: number;
    /** Fitted difficulty at or above this counts as a non-easy item. */
    hardDifficulty: number;
    /** Minimum allocated share for an attempt to count toward gates. */
    minShare: number;
  };
  review: {
    targetR: number;
    margin: number;
    /** Maximum share of a session's items that may be review before review loses priority. */
    cap: number;
    minItemsBeforeCap: number;
    /** Only skills likely acquired can be "reviewed". */
    minLForReview: number;
  };
  dwell: {
    min: number;
    max: number;
    /** Planned items on a skill once chosen; denominator for switch cost. */
    planned: number;
    /** Switching costs this many item-equivalents of attention. */
    switchCostItems: number;
    /** Confusable skills reduce switch cost (interleaving helps discrimination). */
    confusabilityDiscount: number;
    minSwitchCostItems: number;
  };
  scoring: {
    wInfo: number;
    horizonDays: number;
    /** Candidates within this of the best (on [0,1] normalised scale) are near-ties. */
    nearTieEpsilon: number;
    maxTied: number;
    /** Randomesque exposure control: choose uniformly among this many most informative items. */
    itemTopK: number;
  };
  readiness: {
    prereqAvailability: number;
  };
  evidence: {
    /** Weight of a hinted attempt, which is observed as "not correct". 1 = full evidence of not knowing. */
    hintWeight: number;
    retryDecay: number;
  };
  shrinkage: {
    /** Pseudo-attempts of author prior when fitting item difficulty. */
    kappa: number;
    iterations: number;
  };
  safety: {
    consecutiveWrongBreak: number;
  };
  session: {
    gapMinutes: number;
  };
  grid: {
    highConfidence: number;
    lowConfidence: number;
    wideInterval: number;
  };
}

export const DEFAULT_POLICY: PolicyParams = {
  mastery: {
    lowerQuantile: 0.1,
    pLowerMin: 0.85,
    nMin: 8,
    delayedGapDays: 1,
    hardDifficulty: 0.3,
    minShare: 0.5,
  },
  review: {
    targetR: 0.85,
    margin: 0.05,
    cap: 0.5,
    minItemsBeforeCap: 4,
    minLForReview: 0.5,
  },
  dwell: {
    min: 2,
    max: 8,
    planned: 4,
    switchCostItems: 1,
    confusabilityDiscount: 1.5,
    minSwitchCostItems: -1,
  },
  scoring: {
    wInfo: 0.5,
    horizonDays: 7,
    nearTieEpsilon: 0.05,
    maxTied: 3,
    itemTopK: 3,
  },
  readiness: { prereqAvailability: 0.7 },
  evidence: { hintWeight: 1, retryDecay: 0.5 },
  shrinkage: { kappa: 20, iterations: 3 },
  safety: { consecutiveWrongBreak: 3 },
  session: { gapMinutes: 30 },
  grid: { highConfidence: 0.7, lowConfidence: 0.4, wideInterval: 0.45 },
};

export function withPolicy(overrides: DeepPartial<PolicyParams>, base: PolicyParams = DEFAULT_POLICY): PolicyParams {
  return deepMerge(base, overrides);
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function deepMerge<T>(base: T, over: DeepPartial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(over as any)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge((base as any)[k], v as any);
    else if (v !== undefined) out[k] = v;
  }
  return out;
}
