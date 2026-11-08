import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  DEFAULT_MODEL,
  DEFAULT_POLICY,
  FULL_MODEL,
  Item,
  ItemParams,
  betaQuantile,
  masteryStatus,
  newLearner,
  slipGuess,
  update,
  withPolicy,
} from '../index';

const ip = (d: number): ItemParams => ({ difficulty: d, ...slipGuess(d, DEFAULT_MODEL), nObs: 0, source: 'author' });
const single = (id: string, skill: string, kind: Item['kind'] = 'practice'): Item => ({
  id,
  kind,
  authorDifficulty: 0,
  skills: [{ skillId: skill, weight: 1 }],
});
const attempt = (itemId: string, t: number, correct: boolean, extra: object = {}) => ({
  learnerId: 'x',
  itemId,
  t,
  correct,
  hintsUsed: 0,
  attemptNumber: 1,
  ...extra,
});

test('single skill, fresh recall: posterior matches standard BKT', () => {
  const ls = newLearner('x');
  const it = single('i', 'a');
  const p = ip(0);
  const log = update(ls, it, p, attempt('i', 0, true), FULL_MODEL, DEFAULT_POLICY);
  const L = DEFAULT_MODEL.pInit;
  const expected = (L * (1 - p.slip)) / (L * (1 - p.slip) + (1 - L) * p.guess);
  assert.ok(Math.abs(log.skills[0].L_posterior - expected) < 1e-9);
});

test('multi-skill wrong answer blames the weaker skill more', () => {
  const ls = newLearner('x');
  ls.skills.set('strong', { ...newState(), L: 0.9 });
  ls.skills.set('weak', { ...newState(), L: 0.3 });
  const it: Item = { id: 'm', kind: 'practice', authorDifficulty: 0, skills: [{ skillId: 'strong', weight: 1 }, { skillId: 'weak', weight: 1 }] };
  const log = update(ls, it, ip(0), attempt('m', 0, false), FULL_MODEL, DEFAULT_POLICY);
  const s = log.skills.find((x) => x.skillId === 'strong')!;
  const w = log.skills.find((x) => x.skillId === 'weak')!;
  assert.ok(w.blame > s.blame, `blame weak ${w.blame} > strong ${s.blame}`);
  // relative drop is larger for the weak skill
  assert.ok((w.L_before - w.L_posterior) / w.L_before > (s.L_before - s.L_posterior) / s.L_before);
});

test('evidence share: a skill likely blocked by another gets little evidence credit', () => {
  const ls = newLearner('x');
  ls.skills.set('a', { ...newState(), L: 0.5 });
  ls.skills.set('b', { ...newState(), L: 0.05 });
  const it: Item = { id: 'm', kind: 'practice', authorDifficulty: 0, skills: [{ skillId: 'a', weight: 1 }, { skillId: 'b', weight: 1 }] };
  const log = update(ls, it, ip(0), attempt('m', 0, false), FULL_MODEL, DEFAULT_POLICY);
  const a = log.skills.find((x) => x.skillId === 'a')!;
  assert.ok(a.share < 0.2, `share ${a.share}`);
  assert.ok(Math.abs(a.n_after - a.share) < 1e-9);
});

test('secondary weight moves the secondary skill less', () => {
  const ls = newLearner('x');
  const it: Item = { id: 'm', kind: 'practice', authorDifficulty: 0, skills: [{ skillId: 'p', weight: 1 }, { skillId: 's', weight: 0.3 }] };
  const log = update(ls, it, ip(0), attempt('m', 0, true), FULL_MODEL, DEFAULT_POLICY);
  const p = log.skills.find((x) => x.skillId === 'p')!;
  const s = log.skills.find((x) => x.skillId === 's')!;
  assert.ok(p.L_posterior - p.L_before > s.L_posterior - s.L_before);
});

test('item difficulty: a correct answer on a hard item is stronger evidence than on an easy one', () => {
  const easy = newLearner('x');
  const hard = newLearner('x');
  const le = update(easy, single('e', 'a'), ip(-1), attempt('e', 0, true), FULL_MODEL, DEFAULT_POLICY);
  const lh = update(hard, single('h', 'a'), ip(1), attempt('h', 0, true), FULL_MODEL, DEFAULT_POLICY);
  assert.ok(lh.skills[0].L_posterior > le.skills[0].L_posterior);
});

test('a hint counts as not correct', () => {
  const a = newLearner('x');
  const b = newLearner('x');
  const la = update(a, single('i', 's'), ip(0), attempt('i', 0, true, { hintsUsed: 1 }), FULL_MODEL, DEFAULT_POLICY);
  const lb = update(b, single('i', 's'), ip(0), attempt('i', 0, false), FULL_MODEL, DEFAULT_POLICY);
  assert.equal(la.skills[0].L_after, lb.skills[0].L_after);
});

test('evidence decays before new evidence is added', () => {
  const ls = newLearner('x');
  ls.skills.set('a', { ...newState(), n: 4, lastSeen: 0 });
  const t = DEFAULT_MODEL.evidenceHalfLifeDays * DAY_MS;
  const log = update(ls, single('i', 'a'), ip(0), attempt('i', t, true), FULL_MODEL, DEFAULT_POLICY);
  assert.ok(Math.abs(log.skills[0].n_after - (2 + log.skills[0].share)) < 1e-9);
});

test('mastery gate: four easy correct answers in one sitting do not retire a skill', () => {
  const ls = newLearner('x');
  for (let i = 0; i < 4; i++) update(ls, single(`e${i}`, 'a'), ip(-1), attempt(`e${i}`, i * 60_000, true), FULL_MODEL, DEFAULT_POLICY);
  const ms = masteryStatus(ls.skills.get('a')!, DEFAULT_POLICY, DEFAULT_MODEL);
  assert.equal(ms.mastered, false);
  assert.ok(ms.reasons.some((r) => r.startsWith('evidence')));
  assert.ok(ms.reasons.some((r) => r.includes('non-easy')));
  assert.ok(ms.reasons.some((r) => r.includes('gap')));
});

test('mastery gate: enough evidence, a hard pass and a delayed success can pass', () => {
  const ls = newLearner('x');
  let t = 0;
  for (let i = 0; i < 10; i++) {
    update(ls, single(`h${i}`, 'a'), ip(0.5), attempt(`h${i}`, t, true), FULL_MODEL, DEFAULT_POLICY);
    t += i === 5 ? 2 * DAY_MS : 60_000;
  }
  const ms = masteryStatus(ls.skills.get('a')!, DEFAULT_POLICY, DEFAULT_MODEL);
  assert.equal(ms.mastered, true, ms.reasons.join('; '));
});

test('beta quantile sanity', () => {
  assert.ok(Math.abs(betaQuantile(0.1, 1, 1) - 0.1) < 1e-9);
  assert.ok(Math.abs(betaQuantile(0.5, 2, 2) - 0.5) < 1e-9);
  assert.ok(Math.abs(betaQuantile(0.5, 2, 1) - Math.SQRT1_2) < 1e-9); // CDF x^2
});

test('withPolicy merges deeply', () => {
  const p = withPolicy({ review: { cap: 0.2 } });
  assert.equal(p.review.cap, 0.2);
  assert.equal(p.review.targetR, DEFAULT_POLICY.review.targetR);
});

function newState() {
  return {
    L: DEFAULT_MODEL.pInit,
    halfLifeDays: DEFAULT_MODEL.halfLifeInitDays,
    n: 0,
    lastSeen: null as number | null,
    attempts: 0,
    delayedSuccesses: 0,
    hardOrTransferPasses: 0,
    lastCorrect: null as boolean | null,
    lastConfidence: null as number | null,
  };
}
