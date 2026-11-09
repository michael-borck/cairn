import type Database from "@tauri-apps/plugin-sql";
import type {
  Decision,
  EvidenceEvent,
  LearnerId,
  LearnerState,
  StorageAdapter,
} from "@cairn/engine";

const STORAGE_KEY = "cairn.storage.v1";

export interface AppStorage extends StorageAdapter {
  reset(learnerId: LearnerId): Promise<void>;
}

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

export function createLocalStorage(): AppStorage {
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
      return readStore()
        .events.filter((event) => event.learnerId === learnerId)
        .slice()
        .reverse();
    },
    async saveDecision(decision) {
      const store = readStore();
      store.decisions[decision.id] = decision;
      writeStore(store);
    },
    async loadDecision(decisionId) {
      return readStore().decisions[decisionId] ?? null;
    },
    async listDecisions(learnerId) {
      return Object.values(readStore().decisions)
        .filter((decision) => decision.learnerId === learnerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async reset(learnerId) {
      const store = readStore();
      delete store.learners[learnerId];
      store.events = store.events.filter((event) => event.learnerId !== learnerId);
      for (const [id, decision] of Object.entries(store.decisions)) {
        if (decision.learnerId === learnerId) delete store.decisions[id];
      }
      writeStore(store);
    },
  };
}

async function createTables(db: Database): Promise<void> {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS learners (learner_id TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at TEXT NOT NULL)"
  );
  await db.execute(
    "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)"
  );
  await db.execute(
    "CREATE TABLE IF NOT EXISTS decisions (id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)"
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_events_learner ON events(learner_id, created_at)"
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_decisions_learner ON decisions(learner_id, created_at)"
  );
}

function createSqlStorage(db: Database): AppStorage {
  return {
    async loadLearner(learnerId) {
      const rows = await db.select<{ state: string }[]>(
        "SELECT state FROM learners WHERE learner_id = $1",
        [learnerId]
      );
      return rows[0] ? (JSON.parse(rows[0].state) as LearnerState) : null;
    },
    async saveLearner(state) {
      await db.execute(
        "INSERT INTO learners (learner_id, state, updated_at) VALUES ($1, $2, $3) " +
          "ON CONFLICT(learner_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at",
        [state.learnerId, JSON.stringify(state), new Date().toISOString()]
      );
    },
    async appendEvent(event) {
      await db.execute(
        "INSERT OR REPLACE INTO events (id, learner_id, payload, created_at) VALUES ($1, $2, $3, $4)",
        [event.id, event.learnerId, JSON.stringify(event), event.timestamp]
      );
    },
    async listEvents(learnerId) {
      const rows = await db.select<{ payload: string }[]>(
        "SELECT payload FROM events WHERE learner_id = $1 ORDER BY created_at DESC LIMIT 500",
        [learnerId]
      );
      return rows.map((row) => JSON.parse(row.payload) as EvidenceEvent);
    },
    async saveDecision(decision) {
      await db.execute(
        "INSERT OR REPLACE INTO decisions (id, learner_id, payload, created_at) VALUES ($1, $2, $3, $4)",
        [
          decision.id,
          decision.learnerId,
          JSON.stringify(decision),
          decision.createdAt,
        ]
      );
    },
    async loadDecision(decisionId) {
      const rows = await db.select<{ payload: string }[]>(
        "SELECT payload FROM decisions WHERE id = $1",
        [decisionId]
      );
      return rows[0] ? (JSON.parse(rows[0].payload) as Decision) : null;
    },
    async listDecisions(learnerId) {
      const rows = await db.select<{ payload: string }[]>(
        "SELECT payload FROM decisions WHERE learner_id = $1 ORDER BY created_at DESC",
        [learnerId]
      );
      return rows.map((row) => JSON.parse(row.payload) as Decision);
    },
    async reset(learnerId) {
      await db.execute("DELETE FROM events WHERE learner_id = $1", [learnerId]);
      await db.execute("DELETE FROM decisions WHERE learner_id = $1", [learnerId]);
      await db.execute("DELETE FROM learners WHERE learner_id = $1", [learnerId]);
    },
  };
}

export async function createPersistentStorage(): Promise<AppStorage> {
  try {
    const { default: DatabaseClient } = await import("@tauri-apps/plugin-sql");
    const db = await DatabaseClient.load("sqlite:cairn.db");
    await createTables(db);
    return createSqlStorage(db);
  } catch (error) {
    console.warn("SQLite is unavailable. Falling back to local storage.", error);
    return createLocalStorage();
  }
}
