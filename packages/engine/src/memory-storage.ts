import type {
  Decision,
  EvidenceEvent,
  LearnerId,
  LearnerState,
  StorageAdapter,
} from "./types";

export function createMemoryStorage(): StorageAdapter {
  const learners = new Map<LearnerId, LearnerState>();
  const events: EvidenceEvent[] = [];
  const decisions = new Map<string, Decision>();

  return {
    async loadLearner(learnerId) {
      const state = learners.get(learnerId);
      return state ? structuredClone(state) : null;
    },
    async saveLearner(state) {
      learners.set(state.learnerId, structuredClone(state));
    },
    async appendEvent(event) {
      events.push(structuredClone(event));
    },
    async listEvents(learnerId) {
      return events
        .filter((event) => event.learnerId === learnerId)
        .map((event) => structuredClone(event));
    },
    async saveDecision(decision) {
      decisions.set(decision.id, structuredClone(decision));
    },
    async loadDecision(decisionId) {
      const decision = decisions.get(decisionId);
      return decision ? structuredClone(decision) : null;
    },
    async listDecisions(learnerId) {
      return [...decisions.values()]
        .filter((decision) => decision.learnerId === learnerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((decision) => structuredClone(decision));
    },
  };
}
