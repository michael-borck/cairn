/**
 * Replay harness.
 *
 * Order is enforced:
 *   1. evaluatePrediction(): next-response log loss, Brier, AUC and calibration on held-out learners,
 *      for the candidate model and baselines. Produces a PredictionReport with an acceptance verdict.
 *   2. comparePolicies(): only accepts a PredictionReport issued by step 1 (checked at runtime),
 *      and refuses to run if prediction acceptance failed unless force is set.
 *
 * Replay can show that a new policy makes different decisions. It can only estimate whether
 * those decisions are better when logged decisions carry propensities and delayed outcomes
 * (sentinel probes). Without them the report says so and gives differences only.
 */
import { DEFAULT_POLICY, PolicyParams } from './params';
import { BASELINE_BKT, FULL_MODEL, ModelConfig, newLearner, observedCorrect, predict, primarySkill, update } from './model';
import { authorParamsMap, fitItemDifficulties, groupByLearner, isScorable } from './items';
import { Catalog, Decision, PolicyContext, actionProb, buildCatalog, evaluatePolicy } from './policy';
import { Attempt, Item, ItemId, ItemParams, LearnerMode, SkillDef, SkillId } from './types';
import { DAY_MS, clamp, hashString, mean, mulberry32, pearson } from './stats';

export interface DataBundle {
  skills: SkillDef[];
  items: Item[];
  attempts: Attempt[];
  /** Logged decisions with propensities and full distributions (from selectNext). Optional. */
  decisions?: Decision[];
  meta?: { trueDifficulty?: Record<ItemId, number>; [k: string]: unknown };
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  meanPredicted: number;
  observed: number;
}

export interface Metrics {
  n: number;
  logLoss: number;
  brier: number;
  auc: number;
  ece: number;
  calibration: CalibrationBin[];
}

export interface ModelMetrics extends Metrics {
  name: string;
  slices: Record<string, Pick<Metrics, 'n' | 'logLoss' | 'ece'>>;
}

export interface PredictionOptions {
  testFraction?: number;
  seed?: number;
  policy?: PolicyParams;
  /** Candidate must beat the BKT baseline log loss by at least this (absolute). */
  minLogLossImprovement?: number;
  maxEce?: number;
}

interface PredictionReportBody {
  split: { trainLearners: number; testLearners: number; testLearnerIds: string[]; scoredAttempts: number };
  itemFit: {
    itemsWithData: number;
    meanAbsShift: number;
    meanObsPerFittedItem: number;
    corrAuthorVsTrue?: number;
    corrFittedVsTrue?: number;
    rmseAuthorVsTrue?: number;
    rmseFittedVsTrue?: number;
    /** Same, restricted to items with >= 50 scored attempts. */
    rmseAuthorVsTrueWellObserved?: number;
    rmseFittedVsTrueWellObserved?: number;
    itemsWellObserved?: number;
  };
  models: ModelMetrics[];
  candidateName: string;
  baselineName: string;
  acceptance: { passed: boolean; failures: string[]; warnings: string[] };
  /** Fitted params the policy comparison must use. */
  fittedItemParams: Map<ItemId, ItemParams>;
  policy: PolicyParams;
}

declare const reportBrand: unique symbol;
export type PredictionReport = PredictionReportBody & { readonly [reportBrand]: true };
const issuedReports = new WeakSet<object>();

const P_CLIP = 1e-6;

export function computeMetrics(preds: number[], ys: boolean[], bins = 10): Metrics {
  const n = preds.length;
  let ll = 0;
  let br = 0;
  const calib: CalibrationBin[] = Array.from({ length: bins }, (_, i) => ({
    lo: i / bins,
    hi: (i + 1) / bins,
    n: 0,
    meanPredicted: 0,
    observed: 0,
  }));
  for (let i = 0; i < n; i++) {
    const p = clamp(preds[i], P_CLIP, 1 - P_CLIP);
    const y = ys[i] ? 1 : 0;
    ll += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    br += (p - y) ** 2;
    const b = calib[Math.min(bins - 1, Math.floor(preds[i] * bins))];
    b.n += 1;
    b.meanPredicted += preds[i];
    b.observed += y;
  }
  let ece = 0;
  for (const b of calib) {
    if (b.n > 0) {
      b.meanPredicted /= b.n;
      b.observed /= b.n;
      ece += (b.n / Math.max(1, n)) * Math.abs(b.meanPredicted - b.observed);
    }
  }
  return { n, logLoss: n ? ll / n : NaN, brier: n ? br / n : NaN, auc: auc(preds, ys), ece, calibration: calib };
}

function auc(preds: number[], ys: boolean[]): number {
  const idx = preds.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  let rank = 1;
  let sumPos = 0;
  let nPos = 0;
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avg = (rank + rank + (j - i) - 1) / 2;
    for (let k = i; k < j; k++) if (ys[idx[k][1]]) {
      sumPos += avg;
      nPos += 1;
    }
    rank += j - i;
    i = j;
  }
  const nNeg = preds.length - nPos;
  if (nPos === 0 || nNeg === 0) return NaN;
  return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

function splitLearners(ids: string[], testFraction: number, seed: number) {
  const test = new Set(ids.filter((id) => hashString(`${seed}|${id}`) % 10000 < testFraction * 10000));
  return { train: ids.filter((id) => !test.has(id)), test: [...test] };
}

interface ScoredRow {
  p: number;
  y: boolean;
  multiSkill: boolean;
  longGap: boolean;
  firstOnSkill: boolean;
}

function replayScore(
  byLearner: Map<string, Attempt[]>,
  learnerIds: string[],
  catalog: Catalog,
  params: Map<ItemId, ItemParams>,
  cfg: ModelConfig,
  pol: PolicyParams,
): ScoredRow[] {
  const rows: ScoredRow[] = [];
  for (const id of learnerIds) {
    const list = byLearner.get(id) ?? [];
    const ls = newLearner(id, list[0]?.t ?? 0);
    for (const a of list) {
      const item = catalog.itemById.get(a.itemId);
      if (!item) continue;
      const ip = params.get(item.id);
      if (isScorable(a)) {
        const k = primarySkill(item);
        const s = ls.skills.get(k);
        rows.push({
          p: predict(ls, item, ip, a.t, cfg),
          y: observedCorrect(a),
          multiSkill: item.skills.length > 1,
          longGap: !!s && s.lastSeen !== null && a.t - s.lastSeen >= DAY_MS,
          firstOnSkill: !s || s.attempts === 0,
        });
      }
      update(ls, item, ip, a, cfg, pol);
    }
  }
  return rows;
}

function withSlices(name: string, rows: ScoredRow[]): ModelMetrics {
  const all = computeMetrics(rows.map((r) => r.p), rows.map((r) => r.y));
  const slice = (f: (r: ScoredRow) => boolean) => {
    const sub = rows.filter(f);
    const m = computeMetrics(sub.map((r) => r.p), sub.map((r) => r.y));
    return { n: m.n, logLoss: m.logLoss, ece: m.ece };
  };
  return {
    name,
    ...all,
    slices: {
      'multi-skill items': slice((r) => r.multiSkill),
      'single-skill items': slice((r) => !r.multiSkill),
      'gap >= 1 day': slice((r) => r.longGap),
      'first attempt on skill': slice((r) => r.firstOnSkill),
    },
  };
}

export function evaluatePrediction(bundle: DataBundle, opts: PredictionOptions = {}): PredictionReport {
  const pol = opts.policy ?? DEFAULT_POLICY;
  const testFraction = opts.testFraction ?? 0.3;
  const seed = opts.seed ?? 1;
  const minImp = opts.minLogLossImprovement ?? 0;
  const maxEce = opts.maxEce ?? 0.05;
  const catalog = buildCatalog(bundle.skills, bundle.items);
  const byLearner = groupByLearner(bundle.attempts);
  const { train, test } = splitLearners([...byLearner.keys()].sort(), testFraction, seed);
  const trainAttempts = train.flatMap((id) => byLearner.get(id) ?? []);

  const author = authorParamsMap(bundle.items, FULL_MODEL.model);
  const fit = fitItemDifficulties(bundle.items, trainAttempts, FULL_MODEL, pol);

  const trainScorable = trainAttempts.filter(isScorable);
  const baseRate = mean(trainScorable.map((a) => (observedCorrect(a) ? 1 : 0)));

  const testRows = replayScore(byLearner, test, catalog, author, BASELINE_BKT, pol);
  const baseRows = testRows.map((r) => ({ ...r, p: baseRate }));

  const baselineName = 'BKT baseline (no difficulty, no forgetting, primary skill only)';
  const candidateName = 'Ledgers: fitted difficulty + shrinkage, forgetting, multi-skill';
  const models: ModelMetrics[] = [
    withSlices('Base rate', baseRows),
    withSlices(baselineName, testRows),
    withSlices(
      'Ledgers: author difficulty only',
      replayScore(byLearner, test, catalog, author, FULL_MODEL, pol),
    ),
    withSlices(
      'Ledgers: fitted difficulty, multi-skill off',
      replayScore(byLearner, test, catalog, fit.params, { ...FULL_MODEL, useMultiSkill: false }, pol),
    ),
    withSlices(candidateName, replayScore(byLearner, test, catalog, fit.params, FULL_MODEL, pol)),
  ];

  const cand = models.find((m) => m.name === candidateName)!;
  const base = models.find((m) => m.name === baselineName)!;
  const failures: string[] = [];
  const warnings: string[] = [];
  if (!(cand.n > 0)) failures.push('No scorable held-out attempts.');
  if (!(base.logLoss - cand.logLoss >= minImp))
    failures.push(
      `Candidate log loss ${cand.logLoss.toFixed(4)} does not beat baseline ${base.logLoss.toFixed(4)} by ${minImp}.`,
    );
  if (!(cand.ece <= maxEce)) failures.push(`Candidate ECE ${cand.ece.toFixed(4)} exceeds ${maxEce}.`);
  for (const [k, v] of Object.entries(cand.slices)) {
    const b = base.slices[k];
    if (v.n > 0 && b.n > 0 && v.logLoss > b.logLoss)
      warnings.push(`Slice "${k}": candidate log loss ${v.logLoss.toFixed(4)} worse than baseline ${b.logLoss.toFixed(4)}.`);
    if (v.n > 0 && v.n < 200) warnings.push(`Slice "${k}" has only ${v.n} attempts.`);
  }

  const fitted = [...fit.params.values()].filter((p) => p.source === 'fitted');
  const shifts = bundle.items
    .filter((i) => fit.params.get(i.id)?.source === 'fitted')
    .map((i) => Math.abs(fit.params.get(i.id)!.difficulty - author.get(i.id)!.difficulty));
  const itemFit: PredictionReportBody['itemFit'] = {
    itemsWithData: fit.itemsWithData,
    meanAbsShift: mean(shifts),
    meanObsPerFittedItem: mean(fitted.map((p) => p.nObs)),
  };
  const truth = bundle.meta?.trueDifficulty;
  if (truth) {
    const ids = bundle.items.filter((i) => truth[i.id] !== undefined).map((i) => i.id);
    itemFit.corrAuthorVsTrue = pearson(ids.map((id) => author.get(id)!.difficulty), ids.map((id) => truth[id]));
    itemFit.corrFittedVsTrue = pearson(ids.map((id) => fit.params.get(id)!.difficulty), ids.map((id) => truth[id]));
    const rmse = (sel: string[], get: (id: string) => number) =>
      Math.sqrt(mean(sel.map((id) => (get(id) - truth[id]) ** 2)));
    const well = ids.filter((id) => (fit.params.get(id)!.nObs ?? 0) >= 50);
    itemFit.rmseAuthorVsTrue = rmse(ids, (id) => author.get(id)!.difficulty);
    itemFit.rmseFittedVsTrue = rmse(ids, (id) => fit.params.get(id)!.difficulty);
    itemFit.rmseAuthorVsTrueWellObserved = rmse(well, (id) => author.get(id)!.difficulty);
    itemFit.rmseFittedVsTrueWellObserved = rmse(well, (id) => fit.params.get(id)!.difficulty);
    itemFit.itemsWellObserved = well.length;
  }

  const report = {
    split: { trainLearners: train.length, testLearners: test.length, testLearnerIds: test, scoredAttempts: cand.n },
    itemFit,
    models,
    candidateName,
    baselineName,
    acceptance: { passed: failures.length === 0, failures, warnings },
    fittedItemParams: fit.params,
    policy: pol,
  } as PredictionReport;
  issuedReports.add(report);
  return report;
}

export interface PolicyCompareOptions {
  candidatePolicy: PolicyParams;
  force?: boolean;
  mode?: LearnerMode;
  /** Outcome = correctness of the first sentinel on the chosen skill within this window after the decision. */
  outcomeWindowDays?: [number, number];
  bootstrap?: number;
  seed?: number;
  /**
   * 'fitted' (default) replays with fitted item params. 'author' reproduces the state the logging
   * policy saw, if the logs came from this engine: use it for the self-check (logging policy vs itself
   * should give agreement ~1, support ~1 and a value difference ~0).
   */
  itemParamsSource?: 'fitted' | 'author';
}

export interface PolicyReport {
  forced: boolean;
  decisionsReplayed: number;
  attemptsWithUnknownDecision: number;
  agreement: { skill: number; action: number };
  tierMix: { logged: Record<string, number>; candidate: Record<string, number> };
  candidateReviewShareOfDecisions: number;
  loggedReviewShareOfDecisions: number;
  support: { meanCandidateMassOnLoggedSupport: number | null; decisionsWithDistribution: number };
  value: {
    available: boolean;
    why: string;
    decisionsWithOutcome: number;
    decisionsWithPropensity: number;
    loggedMean: number | null;
    candidateSnips: number | null;
    difference: number | null;
    differenceCi95: [number, number] | null;
    effectiveSampleSize: number | null;
  };
  caveats: string[];
}

export function comparePolicies(
  report: PredictionReport,
  bundle: DataBundle,
  opts: PolicyCompareOptions,
): PolicyReport {
  if (!issuedReports.has(report))
    throw new Error('comparePolicies requires a PredictionReport produced by evaluatePrediction on this bundle.');
  if (!report.acceptance.passed && !opts.force)
    throw new Error(
      `Prediction checks failed, so policy differences are not interpretable:\n  ${report.acceptance.failures.join('\n  ')}\nPass force: true to override.`,
    );

  const catalog = buildCatalog(bundle.skills, bundle.items);
  const byLearner = groupByLearner(bundle.attempts);
  const decisions = new Map((bundle.decisions ?? []).map((d) => [d.decisionId, d]));
  const [w0, w1] = opts.outcomeWindowDays ?? [4, 9];
  const itemParams =
    opts.itemParamsSource === 'author' ? authorParamsMap(bundle.items, FULL_MODEL.model) : report.fittedItemParams;
  const ctx: PolicyContext = {
    catalog,
    itemParams,
    cfg: FULL_MODEL,
    policy: opts.candidatePolicy,
    mode: opts.mode ?? 'normal',
    consent: { randomise: true },
  };

  let replayed = 0;
  let unknown = 0;
  let agreeSkill = 0;
  let agreeAction = 0;
  const tierLogged: Record<string, number> = {};
  const tierCand: Record<string, number> = {};
  let candReview = 0;
  let loggedReview = 0;
  const supportMass: number[] = [];
  const rows: { y: number; w: number; learner: string }[] = [];
  let withProp = 0;
  let randomisedLogged = 0;

  for (const id of report.split.testLearnerIds) {
    const list = byLearner.get(id) ?? [];
    const sentinels = new Map<SkillId, Attempt[]>();
    for (const a of list) {
      const item = catalog.itemById.get(a.itemId);
      if (item?.isSentinel) {
        const k = primarySkill(item);
        (sentinels.get(k) ?? sentinels.set(k, []).get(k)!).push(a);
      }
    }
    const ls = newLearner(id, list[0]?.t ?? 0);
    for (const a of list) {
      const item = catalog.itemById.get(a.itemId);
      if (!item) continue;
      if (a.decisionId) {
        const logged = decisions.get(a.decisionId);
        if (!logged) unknown += 1;
        else {
          replayed += 1;
          const ev = evaluatePolicy(ls, ctx, logged.t);
          const ls_ = logged.chosen;
          const pSkill = ev.distribution.filter((d) => d.skillId === ls_.skillId).reduce((s, d) => s + d.prob, 0);
          const pAct = actionProb(ev, ls_.skillId, ls_.move);
          agreeSkill += pSkill;
          agreeAction += pAct;
          tierLogged[logged.tier] = (tierLogged[logged.tier] ?? 0) + 1;
          tierCand[ev.tier] = (tierCand[ev.tier] ?? 0) + 1;
          if (ev.tier === 'review') candReview += 1;
          if (logged.tier === 'review') loggedReview += 1;
          if (logged.distribution?.length) {
            const keys = new Set(logged.distribution.filter((d) => d.prob > 0).map((d) => `${d.skillId}|${d.move}`));
            supportMass.push(
              ev.distribution.filter((d) => keys.has(`${d.skillId}|${d.move}`)).reduce((s, d) => s + d.prob, 0),
            );
          }
          if (logged.propensity > 0 && logged.propensity < 1 - 1e-9) randomisedLogged += 1;
          if (logged.propensity > 0 && ls_.skillId) {
            withProp += 1;
            const after = (sentinels.get(ls_.skillId) ?? []).find(
              (s) => s.t >= logged.t + w0 * DAY_MS && s.t <= logged.t + w1 * DAY_MS,
            );
            if (after) rows.push({ y: observedCorrect(after) ? 1 : 0, w: pAct / logged.propensity, learner: id });
          }
        }
      }
      update(ls, item, itemParams.get(item.id), a, FULL_MODEL, report.policy);
    }
  }

  const caveats: string[] = [];
  const value: PolicyReport['value'] = {
    available: false,
    why: '',
    decisionsWithOutcome: rows.length,
    decisionsWithPropensity: withProp,
    loggedMean: null,
    candidateSnips: null,
    difference: null,
    differenceCi95: null,
    effectiveSampleSize: null,
  };

  const meanSupport = supportMass.length ? mean(supportMass) : null;
  if (replayed === 0) value.why = 'No logged decisions linked to attempts: differences cannot be computed.';
  else if (withProp === 0)
    value.why = 'Logged decisions have no propensities: this report shows differences only, not improvement.';
  else if (randomisedLogged === 0)
    value.why =
      'Every logged propensity is 1: the logging policy never explored, so other actions have no support. Differences only, not improvement.';
  else if (rows.length === 0)
    value.why = 'No delayed sentinel outcomes in the window: this report shows differences only, not improvement.';
  else {
    const snips = (rs: typeof rows) => {
      const sw = rs.reduce((s, r) => s + r.w, 0);
      return sw > 0 ? rs.reduce((s, r) => s + r.w * r.y, 0) / sw : NaN;
    };
    const loggedMean = mean(rows.map((r) => r.y));
    const cand = snips(rows);
    const sw = rows.reduce((s, r) => s + r.w, 0);
    const sw2 = rows.reduce((s, r) => s + r.w * r.w, 0);
    const ess = sw2 > 0 ? (sw * sw) / sw2 : 0;
    // Cluster bootstrap by learner: decisions from one learner share sentinel outcomes and are not independent.
    const byL = new Map<string, typeof rows>();
    for (const r of rows) (byL.get(r.learner) ?? byL.set(r.learner, []).get(r.learner)!).push(r);
    const clusters = [...byL.values()];
    const rng = mulberry32(opts.seed ?? 7);
    const B = opts.bootstrap ?? 500;
    const diffs: number[] = [];
    for (let b = 0; b < B; b++) {
      const sample: typeof rows = [];
      for (let i = 0; i < clusters.length; i++) sample.push(...clusters[Math.floor(rng() * clusters.length)]);
      const d = snips(sample) - mean(sample.map((r) => r.y));
      if (Number.isFinite(d)) diffs.push(d);
    }
    diffs.sort((x, y) => x - y);
    value.available = Number.isFinite(cand);
    value.why = value.available
      ? 'Self-normalised IPS over logged propensities, outcome = delayed sentinel correctness.'
      : 'Candidate puts no mass on any logged action with an outcome.';
    value.loggedMean = loggedMean;
    value.candidateSnips = Number.isFinite(cand) ? cand : null;
    value.difference = Number.isFinite(cand) ? cand - loggedMean : null;
    value.differenceCi95 = diffs.length
      ? [diffs[Math.floor(0.025 * diffs.length)], diffs[Math.floor(0.975 * diffs.length)]]
      : null;
    value.effectiveSampleSize = ess;
    if (ess < 100) caveats.push(`Effective sample size ${ess.toFixed(0)} is small: treat the value estimate as noise.`);
  }
  if (meanSupport === null)
    caveats.push('Logged decisions lack full distributions: cannot check whether the candidate stays within logged support.');
  else if (meanSupport < 0.9)
    caveats.push(
      `Candidate puts only ${(meanSupport * 100).toFixed(0)}% of its mass on actions the logging policy could take: IPS ignores the rest, so the estimate is biased toward the logging policy.`,
    );
  if (opts.itemParamsSource !== 'author')
    caveats.push('Candidate replays with fitted item params; if the logging engine used author params, differences mix model and policy changes.');
  if (opts.force) caveats.push('Run with force: prediction acceptance failed, so these differences may reflect model error.');

  return {
    forced: !!opts.force,
    decisionsReplayed: replayed,
    attemptsWithUnknownDecision: unknown,
    agreement: { skill: replayed ? agreeSkill / replayed : NaN, action: replayed ? agreeAction / replayed : NaN },
    tierMix: { logged: tierLogged, candidate: tierCand },
    candidateReviewShareOfDecisions: replayed ? candReview / replayed : NaN,
    loggedReviewShareOfDecisions: replayed ? loggedReview / replayed : NaN,
    support: { meanCandidateMassOnLoggedSupport: meanSupport, decisionsWithDistribution: supportMass.length },
    value,
    caveats,
  };
}

const f = (x: number | null | undefined, d = 4) => (x === null || x === undefined || Number.isNaN(x) ? 'n/a' : x.toFixed(d));

export function formatPredictionReport(r: PredictionReport): string {
  const lines: string[] = [];
  lines.push('=== 1. PREDICTION (held-out learners, next response; first attempts, hint = not correct) ===');
  lines.push(`Learners: ${r.split.trainLearners} train / ${r.split.testLearners} test. Scored attempts: ${r.split.scoredAttempts}.`);
  lines.push(
    `Item fit: ${r.itemFit.itemsWithData} items with data, mean |fitted - author| ${f(r.itemFit.meanAbsShift, 3)}, mean obs/item ${f(r.itemFit.meanObsPerFittedItem, 1)}` +
      (r.itemFit.corrFittedVsTrue !== undefined
        ? `\n  vs planted truth: RMSE author ${f(r.itemFit.rmseAuthorVsTrue, 3)} -> fitted ${f(r.itemFit.rmseFittedVsTrue, 3)}; ` +
          `items with 50+ obs (${r.itemFit.itemsWellObserved}): ${f(r.itemFit.rmseAuthorVsTrueWellObserved, 3)} -> ${f(r.itemFit.rmseFittedVsTrueWellObserved, 3)}`
        : ''),
  );
  lines.push('');
  lines.push('Model'.padEnd(78) + 'LogLoss  Brier   AUC     ECE');
  for (const m of r.models) {
    const tag = m.name === r.candidateName ? ' *' : m.name === r.baselineName ? ' (baseline)' : '';
    lines.push(`${(m.name + tag).padEnd(78)}${f(m.logLoss)}  ${f(m.brier)}  ${f(m.auc)}  ${f(m.ece)}`);
  }
  const cand = r.models.find((m) => m.name === r.candidateName)!;
  lines.push('');
  lines.push('Log loss by slice (columns follow the model rows above):');
  for (const k of Object.keys(cand.slices))
    lines.push(`  ${k.padEnd(24)} n=${String(cand.slices[k].n).padStart(6)}  ` + r.models.map((m) => f(m.slices[k].logLoss)).join('  '));
  lines.push('');
  lines.push('Calibration, candidate (predicted vs observed per bin):');
  for (const b of cand.calibration)
    if (b.n > 0)
      lines.push(`  [${b.lo.toFixed(1)}, ${b.hi.toFixed(1)})  n=${String(b.n).padStart(6)}  pred ${f(b.meanPredicted, 3)}  obs ${f(b.observed, 3)}`);
  lines.push('');
  lines.push(`Acceptance: ${r.acceptance.passed ? 'PASSED' : 'FAILED'}`);
  for (const x of r.acceptance.failures) lines.push(`  FAIL: ${x}`);
  for (const x of r.acceptance.warnings) lines.push(`  warn: ${x}`);
  return lines.join('\n');
}

export function formatPolicyReport(p: PolicyReport): string {
  const lines: string[] = [];
  lines.push('=== 2. POLICY DIFFERENCES (only after prediction checks) ===');
  lines.push(`Decisions replayed: ${p.decisionsReplayed}${p.attemptsWithUnknownDecision ? ` (${p.attemptsWithUnknownDecision} attempts reference unknown decisions)` : ''}`);
  lines.push(`Expected agreement (candidate probability on the logged choice): skill ${f(p.agreement.skill, 3)}, skill+move ${f(p.agreement.action, 3)}`);
  lines.push(`Review share of decisions: logged ${f(p.loggedReviewShareOfDecisions, 3)}, candidate ${f(p.candidateReviewShareOfDecisions, 3)}`);
  lines.push(`Tier mix logged:    ${JSON.stringify(p.tierMix.logged)}`);
  lines.push(`Tier mix candidate: ${JSON.stringify(p.tierMix.candidate)}`);
  lines.push(`Candidate mass on logged support: ${f(p.support.meanCandidateMassOnLoggedSupport, 3)} over ${p.support.decisionsWithDistribution} decisions`);
  lines.push('');
  lines.push(`Value estimate: ${p.value.available ? 'available' : 'NOT available'} - ${p.value.why}`);
  if (p.value.available) {
    lines.push(`  Decisions with outcome: ${p.value.decisionsWithOutcome} (of ${p.value.decisionsWithPropensity} with propensity)`);
    lines.push(`  Logged policy mean outcome: ${f(p.value.loggedMean, 3)}`);
    lines.push(`  Candidate SNIPS estimate:   ${f(p.value.candidateSnips, 3)}`);
    lines.push(`  Difference: ${f(p.value.difference, 3)}  95% learner-cluster bootstrap CI [${f(p.value.differenceCi95?.[0], 3)}, ${f(p.value.differenceCi95?.[1], 3)}]  ESS ${f(p.value.effectiveSampleSize, 0)}`);
  }
  for (const c of p.caveats) lines.push(`  caveat: ${c}`);
  return lines.join('\n');
}
