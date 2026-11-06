import type {
  Decision,
  EvidenceEvent,
  LearnerId,
  LearnerState,
  StorageAdapter,
} from "@cairn/engine";

const STORAGE_KEY = "cairn.storage.v1";

interface Store {
  learners: Record<string, LearnerState>;
  events: EvidenceEvent[];
  decisions: Record<string, Decision>;
}

function emptyStore(): Store {
  return { learners: {}, events: [], decisions: {} };
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      learners: parsed.learners ?? {},
      events: parsed.events ?? [],
      decisions: parsed.decisions ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function createLocalStorage(): StorageAdapter {
  return {
    async loadLearner(learnerId) {
      return readStore().learners[learnerId] ?? null;
    },
    async saveLearner(state) {
      const store = readStore();
      store.learners[state.learnerId] = state;
      writeStore(store);
    },
    async appendEvent(event) {
      const store = readStore();
      store.events.push(event);
      if (store.events.length > 1000) {
        store.events = store.events.slice(-1000);
      }
      writeStore(store);
    },
    async listEvents(learnerId) {
      return readStore().events.filter((event) => event.learnerId === learnerId);
    },
    async saveDecision(decision) {
      const store = readStore();
      store.decisions[decision.id] = decision;
      writeStore(store);
    },
    async loadDecision(decisionId) {
      return readStore().decisions[decisionId] ?? null;
    },
  };
}

export function resetLearner(learnerId: LearnerId): void {
  const store = readStore();
  delete store.learners[learnerId];
  store.events = store.events.filter((event) => event.learnerId !== learnerId);
  for (const [id, decision] of Object.entries(store.decisions)) {
    if (decision.learnerId === learnerId) delete store.decisions[id];
  }
  writeStore(store);
}
