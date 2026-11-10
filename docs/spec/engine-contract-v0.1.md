# Engine contract v0.1

The engine is a pure TypeScript package. It has no filesystem, network, or UI code. Storage, AI, labs, and UI are adapters.

## Core types

```ts
type SkillId = string;
type ItemId = string;
type LearnerId = string;

interface ContentPack {
  manifest: Manifest;
  curriculum: Curriculum;
  items: Item[];
  rubrics: Rubric[];
  misconceptions: Misconception[];
  labs: Lab[];
  policy: Policy;
}

interface LearnerState {
  learnerId: LearnerId;
  packId: string;
  skills: Record<SkillId, SkillState>;
  preferences: LearnerPreferences;
  calibration: CalibrationState;
  history: LearnerHistory;
  session: SessionState;
  scaffolds: Record<string, ScaffoldState>;
}

interface ScaffoldState {
  attempts: number;
  correct: number;
  consecutiveWrong: number;
  lastAt?: string;
}

interface SessionState {
  startedAt?: string;
  lastAt?: string;
  items: number;
  reviewItems: number;
  currentSkillId?: SkillId;
  dwell: number;
}

interface SkillState {
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

interface CalibrationState {
  answered: number;
  brierScore: number;
  confidentWrong: number;
  unsureCorrect: number;
}

interface LearnerPreferences {
  difficulty: "gentle" | "standard" | "challenge" | "auto";
  help: "none" | "nudge" | "hint" | "walkthrough" | "auto";
  aiMode: "off" | "assist" | "full";
  pathMode: "auto" | "suggest" | "manual";
  sessionMinutes: number;
}
```

## Evidence

```ts
interface EvidenceEvent {
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
  scaffoldId?: string;
  misconceptionIds?: string[];
}

interface RecordResult {
  state: LearnerState;
  misconceptionIds: string[];
  reviewDueAt?: string;
}
```

`correct` is optional because reflection and some teach-back responses have no binary correctness.

## Decisions

```ts
type DecisionAction =
  | "diagnose"
  | "explain"
  | "worked_example"
  | "practice"
  | "review"
  | "remediate"
  | "challenge"
  | "scaffold"
  | "complete";

interface Decision {
  id: string;
  learnerId: LearnerId;
  action: DecisionAction;
  itemId?: ItemId;
  scaffoldId?: string;
  scaffoldPath?: string[];
  skillIds: SkillId[];
  reasonCode: string;
  reason: string;
  evidence: string[];
  confidence: number;
  helpLevel: number;
  alternatives: {
    action: DecisionAction;
    itemId?: ItemId;
    reason: string;
  }[];
  packVersion: string;
  policyVersion: string;
  engineVersion: string;
  createdAt: string;
}
```

Reason codes:

```ts
type ReasonCode =
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
  | "fatigue_detected"
  | "scaffold_step";
```

## Scaffold selection

When a skill reaches `policy.wrongStreak.switchRepresentation` misses in a row, the engine looks for a parent item with a scaffold tree. It returns a `scaffold` decision whose `itemId` is the parent item, `scaffoldId` is the selected node, and `scaffoldPath` is the path from the root.

- The first unseen scaffold at the shallowest level is selected.
- A missed scaffold selects its first unseen child, if one exists.
- A correct scaffold does not select its children.
- Scaffold progress is stored in `learner.scaffolds` under `${itemId}::${scaffoldId}`.
- Scaffold evidence updates the parent skill and is logged with `scaffoldId`.
- If no scaffold remains, the normal wrong-streak remediation path continues.

## Engine API

```ts
interface AdaptiveEngine {
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

interface SessionContext {
  goalSkillIds?: SkillId[];
  availableMinutes: number;
  mode: "auto" | "suggest" | "manual";
}

type OverrideChoice =
  | { type: "easier" }
  | { type: "harder" }
  | { type: "more_help" }
  | { type: "less_help" }
  | { type: "skip"; skillIds: SkillId[] }
  | { type: "review"; skillIds: SkillId[] }
  | { type: "pick_item"; itemId: ItemId };

interface Explanation {
  decisionId: string;
  short: string;
  detailed: string;
  evidence: string[];
  policyVersion: string;
}
```

## Adapters

```ts
interface StorageAdapter {
  loadLearner(learnerId: LearnerId): Promise<LearnerState | null>;
  saveLearner(state: LearnerState): Promise<void>;
  appendEvent(event: EvidenceEvent): Promise<void>;
  listEvents(learnerId: LearnerId): Promise<EvidenceEvent[]>;
  saveDecision(decision: Decision): Promise<void>;
  loadDecision(decisionId: string): Promise<Decision | null>;
  listDecisions(learnerId: LearnerId): Promise<Decision[]>;
}

interface AIAdapter {
  mode: "off" | "assist" | "full";
  generateHint(input: HintInput): Promise<string>;
  gradeShortAnswer(input: GradeInput): Promise<GradeResult>;
  generateVariants(input: VariantInput): Promise<Item[]>;
}

interface LabChecker {
  mode: "manual" | "paste_output";
  evaluate(input: LabResponse): Promise<LabResult>;
}
```

## Determinism

Inject time and randomness for tests.

```ts
interface EngineConfig {
  pack: ContentPack;
  storage: StorageAdapter;
  ai: AIAdapter;
  labChecker: LabChecker;
  now?: () => Date;
  random?: () => number;
}
```

With AI off, the same state and events must produce the same decisions.

## Language-agnostic surface

Expose the same methods over JSON-RPC or a local CLI:

```
loadPack
diagnose
next
record
explain
override
reviewQueue
getState
exportLearner
importLearner
```

The Python package wraps this surface. It does not reimplement policy.
