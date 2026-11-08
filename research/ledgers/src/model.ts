/**
 * Memory and belief ledgers.
 *
 * Per learner x skill: L = P(acquired), half-life (days), n = effective evidence.
 * Retrievability R = 2^(-dt / halfLife). A skill is "available" with prob a = L * R.
 *
 * Multi-skill items use a noisy-AND: tagged skill k blocks success with probability w_k
 * when it is unavailable. So skill k "passes" with q_k = 1 - w_k (1 - L_k R_k) and
 *   P(correct) = guess_i + (1 - slip_i - guess_i) * prod_k q_k
 * Each skill's posterior is computed exactly (assuming independence between skills),
 * from the same pre-update state, so blame and credit are allocated by the model
 * rather than by a hand rule.
 */
import { DAY_MS, MINUTE_MS, betaQuantile, clamp, entropy } from './stats';
import { DEFAULT_MODEL, ModelParams, PolicyParams } from './params';
import { Attempt, Item, ItemParams, LearnerState, SessionState, SkillId, SkillState, SkillTag } from './types';

export interface ModelConfig {
  useDifficulty: boolean;
  useForgetting: boolean;
  useMultiSkill: boolean;
  model: ModelParams;
}

export const FULL_MODEL: ModelConfig = {
  useDifficulty: true,
  useForgetting: true,
  useMultiSkill: true,
  model: DEFAULT_MODEL,
};

export const BASELINE_BKT: ModelConfig = {
  useDifficulty: false,
  useForgetting: false,
  useMultiSkill: false,
  model: DEFAULT_MODEL,
};

const L_EPS = 1e-4;

export function slipGuess(difficulty: number, m: ModelParams): { slip: number; guess: number } {
  return {
    slip: clamp(m.slipBase + m.slipPerDifficulty * difficulty, m.paramMin, m.paramMax),
    guess: clamp(m.guessBase - m.guessPerDifficulty * difficulty, m.paramMin, m.paramMax),
  };
}

export function authorItemParams(item: Item, m: ModelParams): ItemParams {
  const d = clamp(item.authorDifficulty, m.difficultyMin, m.difficultyMax);
  return { difficulty: d, ...slipGuess(d, m), nObs: 0, source: 'author' };
}

export function primaryTag(item: Item): SkillTag {
  let best = item.skills[0];
  for (const t of item.skills) if (t.weight > best.weight) best = t;
  return best;
}

export function primarySkill(item: Item): SkillId {
  return primaryTag(item).skillId;
}

export function effectiveTags(item: Item, cfg: ModelConfig): SkillTag[] {
  if (cfg.useMultiSkill) return item.skills.map((t) => ({ skillId: t.skillId, weight: clamp(t.weight, 0, 1) }));
  return [{ skillId: primarySkill(item), weight: 1 }];
}

export function newSkillState(m: ModelParams): SkillState {
  return {
    L: m.pInit,
    halfLifeDays: m.halfLifeInitDays,
    n: 0,
    lastSeen: null,
    attempts: 0,
    delayedSuccesses: 0,
    hardOrTransferPasses: 0,
    lastCorrect: null,
    lastConfidence: null,
  };
}

export function newSession(t: number): SessionState {
  return {
    startedAt: t,
    lastAt: t,
    items: 0,
    reviewItems: 0,
    currentSkill: null,
    dwell: 0,
    consecutiveWrong: 0,
    recentItems: [],
  };
}

export function newLearner(learnerId: string, t = 0): LearnerState {
  return { learnerId, skills: new Map(), session: newSession(t) };
}

/** Read a skill without inserting it (keeps policy evaluation side-effect free). */
export function peekSkill(ls: LearnerState, k: SkillId, m: ModelParams): SkillState {
  return ls.skills.get(k) ?? newSkillState(m);
}

function ensureSkill(ls: LearnerState, k: SkillId, m: ModelParams): SkillState {
  let s = ls.skills.get(k);
  if (!s) {
    s = newSkillState(m);
    ls.skills.set(k, s);
  }
  return s;
}

/** Session as it would be at time t (a long gap starts a new session). */
export function sessionAt(ls: LearnerState, t: number, pol: PolicyParams): SessionState {
  if (ls.session.items > 0 && t - ls.session.lastAt > pol.session.gapMinutes * MINUTE_MS) return newSession(t);
  return ls.session;
}

export function retrievability(s: SkillState, t: number, cfg: ModelConfig): number {
  if (!cfg.useForgetting || s.lastSeen === null) return 1;
  const dtDays = Math.max(0, t - s.lastSeen) / DAY_MS;
  return Math.pow(2, -dtDays / s.halfLifeDays);
}

export function availability(s: SkillState, t: number, cfg: ModelConfig): number {
  return s.L * retrievability(s, t, cfg);
}

interface SkillTerm {
  skillId: SkillId;
  w: number;
  L: number;
  R: number;
  q: number;
  qLearned: number;
  qNot: number;
}

interface ItemTerms {
  terms: SkillTerm[];
  slip: number;
  guess: number;
  Q: number;
}

function itemSlipGuess(ip: ItemParams | undefined, cfg: ModelConfig): { slip: number; guess: number } {
  if (cfg.useDifficulty && ip) return { slip: ip.slip, guess: ip.guess };
  return slipGuess(0, cfg.model);
}

function itemTerms(ls: LearnerState, item: Item, ip: ItemParams | undefined, t: number, cfg: ModelConfig): ItemTerms {
  const { slip, guess } = itemSlipGuess(ip, cfg);
  const terms = effectiveTags(item, cfg).map((tag) => {
    const s = peekSkill(ls, tag.skillId, cfg.model);
    const R = retrievability(s, t, cfg);
    const w = tag.weight;
    const qLearned = 1 - w * (1 - R);
    const qNot = 1 - w;
    return { skillId: tag.skillId, w, L: s.L, R, q: s.L * qLearned + (1 - s.L) * qNot, qLearned, qNot };
  });
  const Q = terms.reduce((acc, x) => acc * x.q, 1);
  return { terms, slip, guess, Q };
}

function qMinus(terms: SkillTerm[], idx: number): number {
  let p = 1;
  for (let j = 0; j < terms.length; j++) if (j !== idx) p *= terms[j].q;
  return p;
}

/** P(correct) before seeing the response. */
export function predict(ls: LearnerState, item: Item, ip: ItemParams | undefined, t: number, cfg: ModelConfig): number {
  const { slip, guess, Q } = itemTerms(ls, item, ip, t, cfg);
  return guess + (1 - slip - guess) * Q;
}

function conditionalCorrect(term: SkillTerm, Qm: number, slip: number, guess: number) {
  const span = 1 - slip - guess;
  return { pcL: guess + span * Qm * term.qLearned, pcN: guess + span * Qm * term.qNot };
}

/**
 * The observation the model sees: correct AND unassisted. A hint request counts as "not correct",
 * the ASSISTments convention. Dropping hinted attempts instead is a selection bias: learners ask for
 * hints when they do not know, so the remaining attempts look easier than they are.
 */
export function observedCorrect(a: Attempt): boolean {
  return a.correct && a.hintsUsed === 0;
}

/** Evidence weight from hints and retries. Confidence is deliberately excluded: it belongs to calibration. */
export function evidenceWeight(a: Attempt, pol: PolicyParams): number {
  let w = 1;
  if (a.hintsUsed > 0) w *= pol.evidence.hintWeight;
  if (a.attemptNumber > 1) w *= Math.pow(pol.evidence.retryDecay, a.attemptNumber - 1);
  return clamp(w, 0, 1);
}

export function isDue(s: SkillState, t: number, cfg: ModelConfig, pol: PolicyParams): boolean {
  if (!cfg.useForgetting || s.attempts === 0 || s.L < pol.review.minLForReview) return false;
  return retrievability(s, t, cfg) < pol.review.targetR - pol.review.margin;
}

export interface SkillUpdateLog {
  skillId: SkillId;
  weight: number;
  R: number;
  L_before: number;
  L_posterior: number;
  L_after: number;
  /** How much this response could tell us about this skill: Q_-k * w_k * R_k. Drives the evidence count. */
  share: number;
  /** P(this skill blocked success | wrong). 0 when correct. */
  blame: number;
  /** P(learned but not retrieved, and that blocked success | wrong). Drives half-life shrink. */
  forgotBlame: number;
  n_before: number;
  n_after: number;
  halfLife_before: number;
  halfLife_after: number;
  delayedSuccess: boolean;
  hardOrTransferPass: boolean;
}

export interface UpdateLog {
  pCorrect: number;
  evidenceWeight: number;
  wasReview: boolean;
  skills: SkillUpdateLog[];
}

/**
 * Update order, per tagged skill, all computed from the pre-update state:
 *   1. Retrievability at t; evidence decays (decay first, then add).
 *   2. Exact noisy-AND posterior on L, tempered by evidence weight omega.
 *   3. Learning transition (applies even to hinted attempts: practice happened), scaled by tag weight.
 *   4. Half-life: grows on effortful correct retrieval, shrinks on probable forgetting.
 *   5. Gate counters; n += omega * share; lastSeen = t.
 */
export function update(
  ls: LearnerState,
  item: Item,
  ip: ItemParams | undefined,
  a: Attempt,
  cfg: ModelConfig,
  pol: PolicyParams,
): UpdateLog {
  const m = cfg.model;
  ls.session = sessionAt(ls, a.t, pol);

  const it = itemTerms(ls, item, ip, a.t, cfg);
  const { terms, slip, guess } = it;
  const pC = guess + (1 - slip - guess) * it.Q;
  const omega = evidenceWeight(a, pol);
  const y = observedCorrect(a);
  const primary = primarySkill(item);
  const wasReview = isDue(peekSkill(ls, primary, m), a.t, cfg, pol);
  const difficulty = cfg.useDifficulty && ip ? ip.difficulty : 0;

  // Compute everything from pre-update values first, then apply.
  const computed = terms.map((term, idx) => {
    const Qm = qMinus(terms, idx);
    const { pcL, pcN } = conditionalCorrect(term, Qm, slip, guess);
    const likL = y ? pcL : 1 - pcL;
    const likN = y ? pcN : 1 - pcN;
    const num = term.L * likL;
    const den = num + (1 - term.L) * likN;
    const post = den > 0 ? num / den : term.L;
    const share = Qm * term.w * term.R;
    const pWrong = Math.max(1e-9, 1 - pC);
    const blame = y ? 0 : clamp((term.w * (1 - term.L * term.R) * (1 - guess)) / pWrong, 0, 1);
    const forgotBlame = y ? 0 : clamp((term.L * (1 - term.R) * term.w * (1 - guess)) / pWrong, 0, 1);
    return { term, post, share, blame, forgotBlame };
  });

  const logs: SkillUpdateLog[] = computed.map(({ term, post, share, blame, forgotBlame }) => {
    const s = ensureSkill(ls, term.skillId, m);
    const L_before = s.L;
    const n_before = s.n;
    const h_before = s.halfLifeDays;
    const gapDays = s.lastSeen === null ? 0 : Math.max(0, a.t - s.lastSeen) / DAY_MS;

    // 1. decay evidence first (skip on first attempt: no lastSeen)
    if (s.lastSeen !== null) s.n *= Math.pow(2, -gapDays / m.evidenceHalfLifeDays);

    // 2. tempered posterior
    const L_post = clamp(s.L + omega * (post - s.L), L_EPS, 1 - L_EPS);

    // 3. learning transition
    s.L = clamp(L_post + (1 - L_post) * m.learn * term.w, L_EPS, 1 - L_EPS);

    // 4. half-life
    if (cfg.useForgetting) {
      if (y) s.halfLifeDays *= 1 + m.halfLifeGrowth * (1 - term.R) * omega * share * post;
      else s.halfLifeDays *= 1 - (1 - m.halfLifeShrink) * omega * forgotBlame;
      s.halfLifeDays = clamp(s.halfLifeDays, m.halfLifeMinDays, m.halfLifeMaxDays);
    }

    // 5. gate counters and evidence
    const meaningful = y && omega > 0 && share >= pol.mastery.minShare;
    const delayedSuccess = meaningful && s.lastSeen !== null && gapDays >= pol.mastery.delayedGapDays;
    const hardOrTransferPass = meaningful && (difficulty >= pol.mastery.hardDifficulty || !!item.isTransfer);
    if (delayedSuccess) s.delayedSuccesses += 1;
    if (hardOrTransferPass) s.hardOrTransferPasses += 1;
    s.n += omega * share;
    s.attempts += 1;
    s.lastSeen = a.t;
    if (term.skillId === primary) {
      s.lastCorrect = y;
      s.lastConfidence = a.confidence ?? null;
    }

    return {
      skillId: term.skillId,
      weight: term.w,
      R: term.R,
      L_before,
      L_posterior: L_post,
      L_after: s.L,
      share,
      blame,
      forgotBlame,
      n_before,
      n_after: s.n,
      halfLife_before: h_before,
      halfLife_after: s.halfLifeDays,
      delayedSuccess,
      hardOrTransferPass,
    };
  });

  const sess = ls.session;
  sess.items += 1;
  if (wasReview) sess.reviewItems += 1;
  sess.consecutiveWrong = y ? 0 : sess.consecutiveWrong + 1;
  if (sess.currentSkill === primary) sess.dwell += 1;
  else {
    sess.currentSkill = primary;
    sess.dwell = 1;
  }
  sess.recentItems = [...sess.recentItems, item.id].slice(-10);
  sess.lastAt = a.t;

  return { pCorrect: pC, evidenceWeight: omega, wasReview, skills: logs };
}

export interface MasteryStatus {
  mastered: boolean;
  pLower: number;
  pUpper: number;
  reasons: string[];
}

/**
 * Heuristic interval: Beta(L (n + n0), (1 - L)(n + n0)). Not a posterior over BKT parameters.
 * Gate: lower bound, evidence count, a non-easy or transfer pass, and a delayed success.
 */
export function masteryStatus(s: SkillState, pol: PolicyParams, m: ModelParams): MasteryStatus {
  const k = s.n + m.priorStrength;
  const a = clamp(s.L, L_EPS, 1 - L_EPS) * k;
  const b = (1 - clamp(s.L, L_EPS, 1 - L_EPS)) * k;
  const q = pol.mastery.lowerQuantile;
  const pLower = betaQuantile(q, a, b);
  const pUpper = betaQuantile(1 - q, a, b);
  const reasons: string[] = [];
  if (pLower < pol.mastery.pLowerMin) reasons.push(`lower bound ${pLower.toFixed(2)} < ${pol.mastery.pLowerMin}`);
  if (s.n < pol.mastery.nMin) reasons.push(`evidence ${s.n.toFixed(1)} < ${pol.mastery.nMin}`);
  if (s.hardOrTransferPasses < 1) reasons.push('no non-easy or transfer pass');
  if (s.delayedSuccesses < 1) reasons.push(`no success after a gap of ${pol.mastery.delayedGapDays}+ day`);
  return { mastered: reasons.length === 0, pLower, pUpper, reasons };
}

/**
 * Expected entropy reduction (bits) about L_k for each tagged skill, from one response to this item.
 * Uses the same noisy-AND likelihoods as the update, with omega = 1.
 * Sums marginal gains across skills (ignores correlation between skills).
 */
export function itemInfoGain(
  ls: LearnerState,
  item: Item,
  ip: ItemParams | undefined,
  t: number,
  cfg: ModelConfig,
  onlySkill?: SkillId,
): number {
  const { terms, slip, guess } = itemTerms(ls, item, ip, t, cfg);
  let total = 0;
  terms.forEach((term, idx) => {
    if (onlySkill && term.skillId !== onlySkill) return;
    const { pcL, pcN } = conditionalCorrect(term, qMinus(terms, idx), slip, guess);
    const L = term.L;
    const Pc = L * pcL + (1 - L) * pcN;
    if (Pc <= 0 || Pc >= 1) return;
    const postC = (L * pcL) / Pc;
    const postW = (L * (1 - pcL)) / (1 - Pc);
    total += entropy(L) - (Pc * entropy(postC) + (1 - Pc) * entropy(postW));
  });
  return Math.max(0, total);
}

/**
 * Expected change in availability (L * R) at t + horizon from practising this skill now
 * on a typical single-skill item, versus not practising it.
 * Because half-life growth scales with (1 - R), massed practice on a fresh skill yields little:
 * this is the "patch depletion" mechanism, driven by spacing rather than a mastery threshold.
 */
export function expectedAvailabilityGain(
  s: SkillState,
  t: number,
  cfg: ModelConfig,
  horizonDays: number,
): number {
  const m = cfg.model;
  const R = retrievability(s, t, cfg);
  const dtDays = s.lastSeen === null ? 0 : Math.max(0, t - s.lastSeen) / DAY_MS;
  const decay = (days: number, h: number) => (cfg.useForgetting ? Math.pow(2, -days / h) : 1);
  const A_no = s.L * decay(dtDays + horizonDays, s.halfLifeDays);

  const { slip, guess } = slipGuess(0, m);
  const span = 1 - slip - guess;
  const pcL = guess + span * R;
  const pc = guess + span * s.L * R;
  // E[posterior L] = L (martingale), then the learning transition.
  const L_new = s.L + (1 - s.L) * m.learn;
  let h_new = s.halfLifeDays;
  if (cfg.useForgetting) {
    const postC = pc > 0 ? (s.L * pcL) / pc : 0;
    const forgotBlame = pc < 1 ? (s.L * (1 - R) * (1 - guess)) / (1 - pc) : 0;
    const hIfCorrect = s.halfLifeDays * (1 + m.halfLifeGrowth * (1 - R) * R * postC);
    const hIfWrong = s.halfLifeDays * (1 - (1 - m.halfLifeShrink) * clamp(forgotBlame, 0, 1));
    h_new = clamp(pc * hIfCorrect + (1 - pc) * hIfWrong, m.halfLifeMinDays, m.halfLifeMaxDays);
  }
  const A_yes = L_new * decay(horizonDays, h_new);
  return A_yes - A_no;
}

/**
 * Migration from interval scheduling: if a Leitner box schedules review after `intervalDays`, and
 * review is meant to happen when recall falls to targetR, then targetR = 2^(-interval / h), so
 * h = interval / log2(1 / targetR). Use it to seed half-lives so both schedulers agree on day one.
 */
export function halfLifeFromInterval(intervalDays: number, targetR: number, m: ModelParams = DEFAULT_MODEL): number {
  return clamp(intervalDays / Math.log2(1 / targetR), m.halfLifeMinDays, m.halfLifeMaxDays);
}
