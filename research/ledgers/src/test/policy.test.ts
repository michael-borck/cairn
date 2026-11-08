import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  DEFAULT_MODEL,
  DEFAULT_POLICY,
  FULL_MODEL,
  Item,
  PolicyContext,
  PredictionReport,
  SkillDef,
  authorParamsMap,
  buildCatalog,
  comparePolicies,
  evaluatePolicy,
  evaluatePrediction,
  mulberry32,
  newLearner,
  selectNext,
  simulate,
} from '../index';

const skills: SkillDef[] = [
  { id: 'a', prereqs: [] },
  { id: 'b', prereqs: [] },
  { id: 'c', prereqs: ['a'] },
];
const items: Item[] = skills.flatMap((s) =>
  [0, 1, 2, 3].map((i) => ({ id: `${s.id}${i}`, kind: 'practice' as const, authorDifficulty: i / 4 - 0.4, skills: [{ skillId: s.id, weight: 1 }] })),
);
const ctx = (randomise = true): PolicyContext => ({
  catalog: buildCatalog(skills, items),
  itemParams: authorParamsMap(items, DEFAULT_MODEL),
  cfg: FULL_MODEL,
  policy: DEFAULT_POLICY,
  mode: 'normal',
  consent: { randomise },
});
const learned = (lastSeenDaysAgo: number, now: number) => ({
  L: 0.95,
  halfLifeDays: 2,
  n: 10,
  lastSeen: now - lastSeenDaysAgo * DAY_MS,
  attempts: 10,
  delayedSuccesses: 1,
  hardOrTransferPasses: 1,
  lastCorrect: true,
  lastConfidence: null,
});

test('distribution sums to 1 and propensity matches the chosen action', () => {
  const ls = newLearner('x');
  const d = selectNext(ls, ctx(), 0, mulberry32(3));
  const total = d.distribution.reduce((s, x) => s + x.prob, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const pAct = d.distribution.filter((x) => x.skillId === d.chosen.skillId && x.move === d.chosen.move).reduce((s, x) => s + x.prob, 0);
  assert.ok(Math.abs(pAct - d.propensity) < 1e-12);
  assert.ok(d.reason.length > 0);
  assert.ok(d.candidates.length === 3);
});

test('no consent to randomise: deterministic choice, propensity 1', () => {
  const d = selectNext(newLearner('x'), ctx(false), 0, mulberry32(3));
  assert.equal(d.distribution.length, 1);
  assert.equal(d.propensity, 1);
});

test('prerequisite gate excludes a skill until its prerequisite is ready', () => {
  const ev = evaluatePolicy(newLearner('x'), ctx(), 0);
  const c = ev.candidates.find((x) => x.skillId === 'c')!;
  assert.equal(c.eligible, false);
  assert.match(c.excludedBy ?? '', /prerequisite a/);
});

test('due review wins while under the cap, loses priority once the cap is reached', () => {
  const now = 30 * DAY_MS;
  const ls = newLearner('x', now);
  ls.skills.set('a', learned(5, now)); // R = 2^(-5/2) ~ 0.18, due
  let ev = evaluatePolicy(ls, ctx(), now);
  assert.equal(ev.tier, 'review');
  ls.session = { ...ls.session, startedAt: now, lastAt: now, items: 6, reviewItems: 3, currentSkill: 'a', dwell: 3 };
  ev = evaluatePolicy(ls, ctx(), now);
  assert.equal(ev.tier, 'learning');
  assert.match(ev.reason, /review cap/);
});

test('three wrong in a row triggers a break before anything else', () => {
  const ls = newLearner('x', 0);
  ls.session = { ...ls.session, items: 3, consecutiveWrong: 3, lastAt: 0 };
  const ev = evaluatePolicy(ls, ctx(), 1000);
  assert.equal(ev.tier, 'safety');
  assert.equal(ev.distribution[0].move, 'break');
});

test('policy comparison refuses a report it did not issue, and a failed one without force', () => {
  const bundle = simulate({ learners: 40, days: 10, seed: 5 });
  const fake = {} as PredictionReport;
  assert.throws(() => comparePolicies(fake, bundle, { candidatePolicy: DEFAULT_POLICY }), /requires a PredictionReport/);
  const failed = evaluatePrediction(bundle, { maxEce: -1 });
  assert.equal(failed.acceptance.passed, false);
  assert.throws(() => comparePolicies(failed, bundle, { candidatePolicy: DEFAULT_POLICY }), /Prediction checks failed/);
  const forced = comparePolicies(failed, bundle, { candidatePolicy: DEFAULT_POLICY, force: true });
  assert.ok(forced.caveats.some((c) => c.includes('force')));
});

test('self-check: logging policy replayed against its own logs has full support and zero difference', () => {
  const bundle = simulate({ learners: 60, days: 16, seed: 9 });
  const pred = evaluatePrediction(bundle, { maxEce: 1, minLogLossImprovement: -1 });
  const rep = comparePolicies(pred, bundle, { candidatePolicy: DEFAULT_POLICY, itemParamsSource: 'author', bootstrap: 50 });
  assert.ok(Math.abs((rep.support.meanCandidateMassOnLoggedSupport ?? 0) - 1) < 1e-9);
  if (rep.value.available) assert.ok(Math.abs(rep.value.difference ?? 1) < 1e-9);
});

test('deterministic logs (every propensity 1) give differences only, no value estimate', () => {
  const bundle = simulate({ learners: 40, days: 12, seed: 11 });
  bundle.decisions = bundle.decisions!.map((d) => ({ ...d, propensity: 1, distribution: [{ ...d.chosen, prob: 1 }] }));
  const pred = evaluatePrediction(bundle, { maxEce: 1, minLogLossImprovement: -1 });
  const rep = comparePolicies(pred, bundle, { candidatePolicy: DEFAULT_POLICY, bootstrap: 20 });
  assert.equal(rep.value.available, false);
  assert.match(rep.value.why, /never explored/);
});
