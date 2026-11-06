import type { ContentPack } from "@cairn/content";
import {
  createEngine,
  createMemoryStorage,
  type Decision,
  type EvidenceEvent,
} from "@cairn/engine";

export interface SimulationOptions {
  learners: number;
  seed: number;
  maxSteps: number;
  start?: Date;
}

export interface LearnerSimulation {
  learnerId: string;
  completed: boolean;
  steps: number;
  averageMastery: number;
  actionCounts: Record<string, number>;
}

export interface SimulationReport {
  learners: number;
  completed: number;
  completionRate: number;
  averageSteps: number;
  averageMastery: number;
  maxStepsHits: number;
  actionCounts: Record<string, number>;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value =
      (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function successProbability(ability: number, difficulty: number): number {
  return clamp(ability + (3 - difficulty) * 0.08, 0.05, 0.95);
}

function averageMastery(state: {
  skills: Record<string, { mastery: number }>;
}): number {
  const values = Object.values(state.skills).map((skill) => skill.mastery);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function simulateLearner(
  pack: ContentPack,
  learnerIndex: number,
  rng: () => number,
  options: SimulationOptions
): Promise<LearnerSimulation> {
  const learnerId = `sim-${learnerIndex + 1}`;
  const ability = 0.35 + rng() * 0.6;
  const start = options.start ?? new Date();
  let current = new Date(start.getTime());
  let counter = 0;
  const storage = createMemoryStorage();
  const engine = createEngine({
    pack,
    storage,
    now: () => current,
    idFactory: () => `sim-decision-${learnerIndex + 1}-${counter++}`,
  });

  const actionCounts: Record<string, number> = {};
  let completed = false;
  let steps = 0;

  for (; steps < options.maxSteps; steps += 1) {
    const decision: Decision = await engine.next({
      learnerId,
      session: { availableMinutes: 25, mode: "auto" },
    });
    actionCounts[decision.action] = (actionCounts[decision.action] ?? 0) + 1;
    if (decision.action === "complete") {
      completed = true;
      break;
    }

    const item = pack.items.find((entry) => entry.id === decision.itemId);
    if (!item) break;

    const reading =
      item.type === "explain" ||
      item.type === "worked_example" ||
      item.type === "reflection";
    const correct = reading
      ? true
      : rng() < successProbability(ability, item.difficulty);
    const confidence = reading
      ? undefined
      : rng() < 0.2
        ? "guess"
        : rng() < 0.5
          ? "unsure"
          : "sure";

    const event: EvidenceEvent = {
      id: `sim-event-${learnerIndex + 1}-${steps}`,
      learnerId,
      packId: pack.manifest.id,
      packVersion: pack.manifest.version,
      itemId: item.id,
      skillIds: item.skillIds,
      timestamp: current.toISOString(),
      response: "simulated",
      correct,
      score: correct ? 1 : 0,
      confidence,
      hintsUsed: 0,
      attempts: 1,
      durationMs: 30000,
      evidenceSource: reading ? "self" : "learner",
    };
    await engine.record(event);

    current = new Date(current.getTime() + 5 * 60 * 1000);
  }

  const state = await engine.getState(learnerId);
  return {
    learnerId,
    completed,
    steps,
    averageMastery: averageMastery(state),
    actionCounts,
  };
}

export async function simulate(
  pack: ContentPack,
  options: SimulationOptions
): Promise<SimulationReport> {
  const rng = mulberry32(options.seed);
  const results: LearnerSimulation[] = [];
  for (let index = 0; index < options.learners; index += 1) {
    results.push(await simulateLearner(pack, index, rng, options));
  }

  const actionCounts: Record<string, number> = {};
  for (const result of results) {
    for (const [action, count] of Object.entries(result.actionCounts)) {
      actionCounts[action] = (actionCounts[action] ?? 0) + count;
    }
  }

  const completed = results.filter((result) => result.completed).length;
  const totalSteps = results.reduce((sum, result) => sum + result.steps, 0);
  const totalMastery = results.reduce(
    (sum, result) => sum + result.averageMastery,
    0
  );

  return {
    learners: options.learners,
    completed,
    completionRate: options.learners
      ? completed / options.learners
      : 0,
    averageSteps: options.learners ? totalSteps / options.learners : 0,
    averageMastery: options.learners ? totalMastery / options.learners : 0,
    maxStepsHits: results.filter((result) => !result.completed).length,
    actionCounts,
  };
}
