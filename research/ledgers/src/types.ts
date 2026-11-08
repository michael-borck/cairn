export type SkillId = string;
export type ItemId = string;
export type LearnerId = string;

export type ItemKind = 'practice' | 'worked' | 'probe' | 'contrast' | 'erroneous' | 'transfer';

export type Move =
  | 'practice'
  | 'retrieve'
  | 'worked'
  | 'probe'
  | 'contrast'
  | 'erroneous'
  | 'transfer'
  | 'explain'
  | 'break';

export type LearnerMode = 'normal' | 'gentle' | 'challenge' | 'review' | 'explore';

/** One skill an item exercises. weight 1 = primary; <1 = secondary (noisy-AND: blocks success with prob `weight` when unavailable). */
export interface SkillTag {
  skillId: SkillId;
  weight: number;
}

export interface SkillDef {
  id: SkillId;
  prereqs: SkillId[];
}

export interface Item {
  id: ItemId;
  skills: SkillTag[];
  /** Author rating on roughly [-1, 1]: -1 easy, 0 typical, +1 hard. The prior for fitted difficulty. */
  authorDifficulty: number;
  kind: ItemKind;
  context?: string;
  isTransfer?: boolean;
  /** Sentinels are never chosen by the policy; they exist only to measure outcomes. */
  isSentinel?: boolean;
  misconceptionTags?: string[];
}

export interface ItemParams {
  difficulty: number;
  slip: number;
  guess: number;
  /** Scorable attempts the fit used (0 for author-only). */
  nObs: number;
  source: 'author' | 'fitted';
}

export interface Attempt {
  learnerId: LearnerId;
  itemId: ItemId;
  /** Epoch milliseconds. */
  t: number;
  correct: boolean;
  hintsUsed: number;
  /** 1 = first try at this item instance. */
  attemptNumber: number;
  /** Sampled, 0..1. Absent on most attempts by design. Never enters the mastery update. */
  confidence?: number;
  latencyMs?: number;
  /** Links the attempt to the logged decision that chose it. Absent for sentinels. */
  decisionId?: string;
}

export interface SkillState {
  /** P(acquired). BKT state. */
  L: number;
  halfLifeDays: number;
  /** Effective evidence count; decays with time, grows by allocated share. */
  n: number;
  lastSeen: number | null;
  attempts: number;
  delayedSuccesses: number;
  hardOrTransferPasses: number;
  lastCorrect: boolean | null;
  lastConfidence: number | null;
}

export interface SessionState {
  startedAt: number;
  lastAt: number;
  items: number;
  reviewItems: number;
  currentSkill: SkillId | null;
  dwell: number;
  consecutiveWrong: number;
  recentItems: ItemId[];
}

export interface LearnerState {
  learnerId: LearnerId;
  skills: Map<SkillId, SkillState>;
  session: SessionState;
}
