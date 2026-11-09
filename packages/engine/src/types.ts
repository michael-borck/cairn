import type {
  ContentPack,
  Item,
  ItemId,
  Rubric,
  SkillId,
} from "@cairn/content";

export type LearnerId = string;
export type EngineVersion = "0.1.0";
export const ENGINE_VERSION: EngineVersion = "0.1.0";

export type DifficultyPreference = "gentle" | "standard" | "challenge" | "auto";
export type HelpPreference = "none" | "nudge" | "hint" | "walkthrough" | "auto";
export type AIMode = "off" | "assist" | "full";
export type PathMode = "auto" | "suggest" | "manual";

export interface LearnerPreferences {
  difficulty: DifficultyPreference;
  help: HelpPreference;
  aiMode: AIMode;
  pathMode: PathMode;
  sessionMinutes: number;
}

export const DEFAULT_PREFERENCES: LearnerPreferences = {
  difficulty: "auto",
  help: "auto",
  aiMode: "off",
  pathMode: "auto",
  sessionMinutes: 25,
};

export interface SkillState {
  mastery: number;
  confidence: number;
  attempts: number;
  correct: number;
  lastSeenAt?: string;
  nextReviewAt?: string;
  reviewIntervalDays: number;
  evidenceCount: number;
  halfLifeDays: number;
  hardPasses: number;
  delayedPasses: number;
  misconceptions: Record<string, number>;
  difficultyElo: number;
  consecutiveWrong: number;
  consecutiveCorrect: number;
}

export interface CalibrationState {
  answered: number;
  brierScore: number;
  confidentWrong: number;
  unsureCorrect: number;
}

export interface LearnerHistory {
  sessions: number;
  totalMinutes: number;
  lastSessionAt?: string;
  recentItemIds: string[];
}

export interface SessionState {
  startedAt?: string;
  lastAt?: string;
  items: number;
  reviewItems: number;
  currentSkillId?: SkillId;
  dwell: number;
}

export interface LearnerState {
  learnerId: LearnerId;
  packId: string;
  skills: Record<SkillId, SkillState>;
  preferences: LearnerPreferences;
  calibration: CalibrationState;
  history: LearnerHistory;
  session: SessionState;
}

export interface EvidenceEvent {
  id: string;
  learnerId: LearnerId;
  packId: string;
  packVersion: string;
  itemId: ItemId;
  skillIds: SkillId[];
  timestamp: string;
  response: unknown;
  correct?: boolean;
  score?: number;
  confidence?: "guess" | "unsure" | "sure";
  hintsUsed: number;
  attempts: number;
  durationMs: number;
  evidenceSource: "learner" | "ai" | "lab" | "self";
  action?: DecisionAction;
  decisionId?: string;
  misconceptionIds?: string[];
}

export interface RecordResult {
  state: LearnerState;
  misconceptionIds: string[];
  reviewDueAt?: string;
}

export type DecisionAction =
  | "diagnose"
  | "explain"
  | "worked_example"
  | "practice"
  | "review"
  | "remediate"
  | "challenge"
  | "complete";

export type ReasonCode =
  | "review_due"
  | "prerequisite_gap"
  | "low_mastery"
  | "guided_practice"
  | "independent_practice"
  | "retention_check"
  | "wrong_streak_similar_item"
  | "wrong_streak_switch_representation"
  | "misconception_repeated"
  | "challenge_passed"
  | "learner_override"
  | "session_goal_met"
  | "fatigue_detected";

export interface DecisionAlternative {
  action: DecisionAction;
  itemId?: ItemId;
  reason: string;
}

export interface Decision {
  id: string;
  learnerId: LearnerId;
  action: DecisionAction;
  itemId?: ItemId;
  skillIds: SkillId[];
  reasonCode: ReasonCode;
  reason: string;
  evidence: string[];
  confidence: number;
  /** Suggested help level: 0 none, 1 nudge, 2 hint, 3 walkthrough, 4 full solution. */
  helpLevel: number;
  alternatives: DecisionAlternative[];
  packVersion: string;
  policyVersion: string;
  engineVersion: EngineVersion;
  createdAt: string;
}

export interface SessionContext {
  goalSkillIds?: SkillId[];
  availableMinutes: number;
  mode: "auto" | "suggest" | "manual";
}

export type OverrideChoice =
  | { type: "easier" }
  | { type: "harder" }
  | { type: "more_help" }
  | { type: "less_help" }
  | { type: "skip"; skillIds: SkillId[] }
  | { type: "review"; skillIds: SkillId[] }
  | { type: "pick_item"; itemId: ItemId };

export interface Explanation {
  decisionId: string;
  short: string;
  detailed: string;
  evidence: string[];
  policyVersion: string;
}

export interface ReviewItem {
  skillId: SkillId;
  itemId?: ItemId;
  dueAt?: string;
  overdueDays: number;
  mastery: number;
}

export interface LearnerExport {
  schemaVersion: "0.1";
  exportedAt: string;
  state: LearnerState;
}

export interface HintInput {
  learnerId: LearnerId;
  item: Item;
  skillId: SkillId;
  mastery: number;
}

export interface GradeInput {
  item: Item;
  response: string;
  rubric?: Rubric;
}

export interface GradeResult {
  score: number;
  feedback: string;
  misconceptionIds?: string[];
}

export interface VariantInput {
  item: Item;
  difficulty: number;
}

export interface AIAdapter {
  mode: AIMode;
  generateHint(input: HintInput): Promise<string>;
  gradeShortAnswer(input: GradeInput): Promise<GradeResult>;
  generateVariants(input: VariantInput): Promise<Item[]>;
}

export interface LabResponse {
  labId: string;
  response: string;
}

export interface LabResult {
  passed: boolean;
  checks: {
    id: string;
    passed: boolean;
    feedback?: string;
  }[];
}

export interface LabChecker {
  mode: "manual" | "paste_output";
  evaluate(input: LabResponse): Promise<LabResult>;
}

export interface StorageAdapter {
  loadLearner(learnerId: LearnerId): Promise<LearnerState | null>;
  saveLearner(state: LearnerState): Promise<void>;
  appendEvent(event: EvidenceEvent): Promise<void>;
  listEvents(learnerId: LearnerId): Promise<EvidenceEvent[]>;
  saveDecision(decision: Decision): Promise<void>;
  loadDecision(decisionId: string): Promise<Decision | null>;
  listDecisions(learnerId: LearnerId): Promise<Decision[]>;
}

export interface EngineConfig {
  pack: ContentPack;
  storage: StorageAdapter;
  ai?: AIAdapter;
  labChecker?: LabChecker;
  now?: () => Date;
  random?: () => number;
  idFactory?: () => string;
}

export interface AdaptiveEngine {
  loadPack(pack: ContentPack): Promise<void>;
  diagnose(input: {
    learnerId: LearnerId;
    goalSkillIds?: SkillId[];
    maxItems?: number;
  }): Promise<Decision[]>;
  next(input: {
    learnerId: LearnerId;
    session: SessionContext;
  }): Promise<Decision>;

  challenge(input: {
    learnerId: LearnerId;
    skillId: SkillId;
  }): Promise<Decision>;
  record(event: EvidenceEvent): Promise<RecordResult>;
  explain(decisionId: string): Promise<Explanation>;
  override(input: {
    learnerId: LearnerId;
    decisionId: string;
    choice: OverrideChoice;
  }): Promise<Decision>;
  reviewQueue(learnerId: LearnerId): Promise<ReviewItem[]>;
  getState(learnerId: LearnerId): Promise<LearnerState>;
  exportLearner(learnerId: LearnerId): Promise<LearnerExport>;
  importLearner(data: LearnerExport): Promise<LearnerState>;
}
