/**
 * Synthetic learners, for checking that the code runs end to end and recovers planted item difficulty.
 * This is NOT evidence that the theory works: the simulator shares the model's functional form.
 * Real conclusions need real logs.
 */
import { DEFAULT_MODEL, DEFAULT_POLICY, PolicyParams } from './params';
import { FULL_MODEL, newLearner, primarySkill, slipGuess, update } from './model';
import { authorParamsMap } from './items';
import { Decision, PolicyContext, buildCatalog, selectNext } from './policy';
import { DataBundle } from './harness';
import { Attempt, Item, ItemKind, Move, SkillDef, SkillId } from './types';
import { DAY_MS, Rng, clamp, mulberry32 } from './stats';

export interface SimOptions {
  learners?: number;
  days?: number;
  itemsPerSession?: number;
  seed?: number;
  policy?: PolicyParams;
}

const SKILLS: SkillDef[] = [
  { id: 's1', prereqs: [] },
  { id: 's2', prereqs: ['s1'] },
  { id: 's3', prereqs: ['s2'] },
  { id: 's4', prereqs: ['s1'] },
  { id: 's5', prereqs: ['s4'] },
  { id: 's6', prereqs: ['s2', 's4'] },
];
const SECONDARY: Record<SkillId, SkillId | undefined> = { s3: 's2', s6: 's4', s5: 's4' };
const MISCONCEPTIONS: Record<SkillId, string[]> = {
  s2: ['m-order'],
  s3: ['m-order', 'm-scope'],
  s4: ['m-sign'],
  s5: ['m-sign'],
  s6: ['m-scope'],
};
const MOVE_LEARN: Record<Move, number> = {
  practice: 1,
  retrieve: 1,
  worked: 1.3,
  probe: 0.8,
  contrast: 1.4,
  erroneous: 1.2,
  transfer: 0.8,
  explain: 1.1,
  break: 0,
};

function gauss(rng: Rng): number {
  const u = Math.max(1e-12, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function buildItems(rng: Rng): { items: Item[]; trueDifficulty: Record<string, number> } {
  const items: Item[] = [];
  const trueDifficulty: Record<string, number> = {};
  const add = (skill: SkillId, kind: ItemKind, idx: number, extra: Partial<Item> = {}) => {
    const author = Math.round((rng() * 2 - 1) * 10) / 10;
    const id = `${skill}-${kind}-${idx}${extra.isSentinel ? '-sentinel' : ''}`;
    const secondary = SECONDARY[skill];
    const multi = secondary && kind === 'practice' && idx % 2 === 0;
    items.push({
      id,
      kind,
      authorDifficulty: author,
      skills: multi ? [{ skillId: skill, weight: 1 }, { skillId: secondary!, weight: 0.6 }] : [{ skillId: skill, weight: 1 }],
      misconceptionTags: kind === 'contrast' || kind === 'erroneous' ? MISCONCEPTIONS[skill] : undefined,
      ...extra,
    });
    // authors are roughly right, with noise: shrinkage should move fitted values toward truth
    trueDifficulty[id] = clamp(author + 0.5 * gauss(rng), -2, 2);
  };
  for (const s of SKILLS) {
    for (let i = 0; i < 12; i++) add(s.id, 'practice', i);
    for (let i = 0; i < 2; i++) add(s.id, 'worked', i);
    for (let i = 0; i < 2; i++) add(s.id, 'probe', i);
    if (MISCONCEPTIONS[s.id]) {
      for (let i = 0; i < 2; i++) add(s.id, 'contrast', i);
      for (let i = 0; i < 2; i++) add(s.id, 'erroneous', i);
    }
    for (let i = 0; i < 3; i++) add(s.id, 'transfer', i, { isTransfer: true, context: `ctx-${i}` });
    for (let i = 0; i < 2; i++) add(s.id, 'practice', 100 + i, { isSentinel: true });
  }
  return { items, trueDifficulty };
}

interface TrueSkill {
  learned: boolean;
  h: number;
  lastSeen: number | null;
  learnRate: number;
}

export function simulate(opts: SimOptions = {}): DataBundle {
  const rng = mulberry32(opts.seed ?? 42);
  const nLearners = opts.learners ?? 300;
  const days = opts.days ?? 24;
  const perSession = opts.itemsPerSession ?? 12;
  const pol = opts.policy ?? DEFAULT_POLICY;
  const { items, trueDifficulty } = buildItems(rng);
  const catalog = buildCatalog(SKILLS, items);
  const ctx: PolicyContext = {
    catalog,
    itemParams: authorParamsMap(items, DEFAULT_MODEL), // the logging policy only knows author ratings
    cfg: FULL_MODEL,
    policy: pol,
    mode: 'normal',
    consent: { randomise: true },
  };

  const attempts: Attempt[] = [];
  const decisions: Decision[] = [];
  const t0 = Date.UTC(2026, 0, 5);

  for (let li = 0; li < nLearners; li++) {
    const learnerId = `L${String(li).padStart(4, '0')}`;
    const overconfident = rng() < 0.3;
    const truth = new Map<SkillId, TrueSkill>(
      SKILLS.map((s) => [
        s.id,
        { learned: rng() < (s.id === 's1' ? 0.4 : 0.1), h: 1.5, lastSeen: null, learnRate: 0.1 + 0.2 * rng() },
      ]),
    );
    const ls = newLearner(learnerId, t0);

    const respond = (item: Item, move: Move, t: number, decisionId?: string): Attempt => {
      let passes = true;
      const availableBy = new Map<SkillId, boolean>();
      for (const tag of item.skills) {
        const ts = truth.get(tag.skillId)!;
        const R = ts.learned && ts.lastSeen !== null ? Math.pow(2, -(t - ts.lastSeen) / DAY_MS / ts.h) : ts.learned ? 1 : 0;
        const avail = rng() < R;
        availableBy.set(tag.skillId, avail);
        if (!avail && rng() < tag.weight) passes = false;
      }
      const { slip, guess } = slipGuess(trueDifficulty[item.id], DEFAULT_MODEL);
      let hintsUsed = 0;
      let correct: boolean;
      if (!passes && rng() < 0.25) {
        hintsUsed = 1;
        correct = rng() < 0.7;
      } else correct = passes ? rng() > slip : rng() < guess;
      let confidence: number | undefined;
      if (rng() < 0.3) {
        const baseConf = passes ? 0.8 : overconfident ? 0.8 : 0.3;
        confidence = clamp(baseConf + 0.1 * gauss(rng), 0, 1);
      }
      for (const tag of item.skills) {
        const ts = truth.get(tag.skillId)!;
        const avail = availableBy.get(tag.skillId)!;
        if (ts.learned) {
          const R = ts.lastSeen !== null ? Math.pow(2, -(t - ts.lastSeen) / DAY_MS / ts.h) : 1;
          if (avail && correct) ts.h = clamp(ts.h * (1 + 1.2 * (1 - R)), 0.3, 200);
          else if (!avail) ts.h = clamp(ts.h * 0.7, 0.3, 200);
        } else if (rng() < ts.learnRate * MOVE_LEARN[move] * tag.weight) {
          ts.learned = true;
          ts.h = 1.5;
        }
        ts.lastSeen = t;
      }
      return { learnerId, itemId: item.id, t, correct, hintsUsed, attemptNumber: 1, confidence, decisionId };
    };

    for (let day = 0; day < days; day++) {
      if (rng() > 0.75) continue;
      let t = t0 + day * DAY_MS + Math.floor((17 + 4 * rng()) * 3_600_000);
      if (day % 4 === 3) {
        // scheduled sentinels: outside the policy, never chosen by it
        for (const s of SKILLS) {
          if (!ls.skills.get(s.id)?.attempts) continue;
          const pool = items.filter((i) => i.isSentinel && primarySkill(i) === s.id);
          const item = pool[day % pool.length];
          const a = respond(item, 'practice', t);
          attempts.push(a);
          update(ls, item, ctx.itemParams.get(item.id), a, FULL_MODEL, pol);
          t += 40_000;
        }
      }
      for (let k = 0; k < perSession; k++) {
        const d = selectNext(ls, ctx, t, rng);
        decisions.push(d);
        if (d.chosen.move === 'break' || !d.chosen.skillId) break;
        let item = d.chosen.itemId ? catalog.itemById.get(d.chosen.itemId) : undefined;
        if (!item) {
          // stands in for generated content for this move
          const pool = (catalog.itemsByPrimary.get(d.chosen.skillId) ?? []).filter((i) => !i.isSentinel && i.kind === 'practice');
          item = pool[Math.floor(rng() * pool.length)];
        }
        const a = respond(item, d.chosen.move, t + 20_000, d.decisionId);
        attempts.push(a);
        update(ls, item, ctx.itemParams.get(item.id), a, FULL_MODEL, pol);
        t += 45_000 + Math.floor(30_000 * rng());
      }
    }
  }
  return { skills: SKILLS, items, attempts, decisions, meta: { trueDifficulty, generator: 'ledgers-sim-0.1.0' } };
}
