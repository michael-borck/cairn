/**
 * Wayfinder controller.
 *
 * Ordered policy:
 *   1. Safety and consent        (hard: break on frustration; randomise only with consent)
 *   2. Learner-chosen mode       (hard: filters skills and moves)
 *   3. Prerequisite readiness    (gate; a passed challenge test also opens it)
 *   4. Due review                (wins only while the session's review share is under the cap)
 *   5. Expected availability gain + information gain (min-max normalised within candidates)
 *   6. Exploration               (via near-tie randomisation and the information term)
 *
 * Every evaluation returns a full probability distribution over (skill, move) actions,
 * so propensities are exact and the harness can compute pi_new(a) for any logged action.
 */
import { MODEL_VERSION, POLICY_VERSION, PolicyParams } from './params';
import {
  MasteryStatus,
  ModelConfig,
  availability,
  expectedAvailabilityGain,
  isDue,
  itemInfoGain,
  masteryStatus,
  peekSkill,
  primarySkill,
  retrievability,
  sessionAt,
} from './model';
import { Item, ItemId, ItemKind, ItemParams, LearnerMode, LearnerState, Move, SkillDef, SkillId, SkillState } from './types';
import { Rng, hashString, minMax } from './stats';

export interface Catalog {
  skills: SkillDef[];
  items: Item[];
  itemById: Map<ItemId, Item>;
  itemsByPrimary: Map<SkillId, Item[]>;
  importance: Map<SkillId, number>;
  confusability: (a: SkillId, b: SkillId) => number;
}

export function buildCatalog(skills: SkillDef[], items: Item[]): Catalog {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const itemsByPrimary = new Map<SkillId, Item[]>();
  const tags = new Map<SkillId, Set<string>>();
  for (const it of items) {
    const k = primarySkill(it);
    (itemsByPrimary.get(k) ?? itemsByPrimary.set(k, []).get(k)!).push(it);
    const set = tags.get(k) ?? tags.set(k, new Set()).get(k)!;
    for (const tg of it.misconceptionTags ?? []) set.add(tg);
  }
  // importance = 1 + ln(1 + number of transitive dependents): option value of keeping a skill alive
  const dependents = new Map<SkillId, Set<SkillId>>();
  for (const s of skills) dependents.set(s.id, new Set());
  const children = new Map<SkillId, SkillId[]>();
  for (const s of skills) for (const p of s.prereqs) (children.get(p) ?? children.set(p, []).get(p)!).push(s.id);
  const collect = (k: SkillId, acc: Set<SkillId>) => {
    for (const c of children.get(k) ?? []) if (!acc.has(c)) {
      acc.add(c);
      collect(c, acc);
    }
  };
  const importance = new Map<SkillId, number>();
  for (const s of skills) {
    const acc = new Set<SkillId>();
    collect(s.id, acc);
    importance.set(s.id, 1 + Math.log1p(acc.size));
  }
  const confusability = (a: SkillId, b: SkillId): number => {
    const A = tags.get(a);
    const B = tags.get(b);
    if (!A || !B || A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter += 1;
    return inter / (A.size + B.size - inter);
  };
  return { skills, items, itemById, itemsByPrimary, importance, confusability };
}

export interface PolicyContext {
  catalog: Catalog;
  itemParams: Map<ItemId, ItemParams>;
  cfg: ModelConfig;
  policy: PolicyParams;
  mode: LearnerMode;
  consent: { randomise: boolean };
  challengePassed?: Set<SkillId>;
  safetyHold?: boolean;
}

export type Tier = 'safety' | 'review' | 'learning' | 'none';

export interface CandidateLog {
  skillId: SkillId;
  eligible: boolean;
  excludedBy: string | null;
  L: number;
  R: number;
  pLower: number;
  pUpper: number;
  n: number;
  mastered: boolean;
  due: boolean;
  retentionLoss: number;
  gain: number;
  infoGain: number;
  importance: number;
  baseScore: number | null;
  switchFactor: number | null;
  score: number | null;
}

export interface MoveOption {
  move: Move;
  score: number;
  why: string;
}

export interface ActionProb {
  skillId: SkillId | null;
  move: Move;
  itemId: ItemId | null;
  /** Difficulty the engine used for this item at decision time (for refits and audits). */
  itemDifficulty: number | null;
  prob: number;
}

export interface PolicyEvaluation {
  learnerId: string;
  t: number;
  modelVersion: string;
  policyVersion: string;
  /** Hash of the exact model config and policy params used, so replays can detect drift. */
  paramsHash: string;
  mode: LearnerMode;
  tier: Tier;
  session: {
    items: number;
    reviewItems: number;
    reviewShare: number;
    capReached: boolean;
    currentSkill: SkillId | null;
    dwell: number;
  };
  candidates: CandidateLog[];
  moveOptions: Record<SkillId, MoveOption[]>;
  distribution: ActionProb[];
  randomised: boolean;
  reason: string;
}

export interface Decision extends PolicyEvaluation {
  decisionId: string;
  chosen: ActionProb;
  /** Probability the logging policy assigned to the chosen (skill, move). Used for IPS. */
  propensity: number;
  /** Probability of the chosen item given (skill, move): exposure-control randomisation. */
  itemPropensity: number;
  rngDraw: number;
}

const MOVE_ITEM_KINDS: Record<Move, ItemKind[]> = {
  practice: ['practice'],
  retrieve: ['practice'],
  worked: ['worked', 'practice'],
  probe: ['probe', 'practice'],
  contrast: ['contrast', 'practice'],
  erroneous: ['erroneous'],
  transfer: ['transfer'],
  explain: ['practice'],
  break: [],
};

/** Confidence x accuracy grid. Returns moves with scores on [0, 1]; near-ties are randomised later. */
export function gridMoves(
  s: SkillState,
  ms: MasteryStatus,
  tier: Tier,
  mode: LearnerMode,
  pol: PolicyParams,
): MoveOption[] {
  const g = pol.grid;
  const conf = s.lastConfidence;
  const last = s.lastCorrect;
  const width = ms.pUpper - ms.pLower;
  let opts: MoveOption[] = [];

  if (tier === 'review') {
    opts.push({ move: 'retrieve', score: 1, why: 'retention below target' });
  } else if (s.attempts === 0 || width > g.wideInterval) {
    opts.push({ move: 'probe', score: 1, why: `uncertainty band wide (${width.toFixed(2)})` });
    opts.push({ move: 'practice', score: 0.7, why: 'fallback' });
  } else if (last === false && conf !== null && conf >= g.highConfidence) {
    opts.push({ move: 'contrast', score: 1, why: 'confident but wrong' });
    opts.push({ move: 'erroneous', score: 0.97, why: 'confident but wrong' });
    opts.push({ move: 'worked', score: 0.6, why: 'confident but wrong' });
  } else if (last === false && (conf !== null ? conf <= g.lowConfidence : s.L < 0.4)) {
    opts.push({ move: 'worked', score: 1, why: 'wrong and unsure' });
    opts.push({ move: 'practice', score: 0.5, why: 'wrong and unsure' });
  } else if (last === true && conf !== null && conf <= g.lowConfidence) {
    opts.push({ move: 'explain', score: 1, why: 'right but unsure: consolidate' });
    opts.push({ move: 'practice', score: 0.8, why: 'right but unsure' });
  } else if (last === true && conf !== null && conf >= g.highConfidence) {
    if (ms.mastered) {
      opts.push({ move: 'transfer', score: 1, why: 'confident, right and mastered: test transfer' });
      opts.push({ move: 'practice', score: 0.6, why: 'confident and right' });
    } else {
      opts.push({ move: 'practice', score: 1, why: 'confident and right, not yet mastered' });
      if (s.L > 0.7) opts.push({ move: 'transfer', score: 0.5, why: 'early transfer check' });
    }
  } else if (s.L < 0.4) {
    opts.push({ move: 'worked', score: 1, why: 'low mastery' });
    opts.push({ move: 'practice', score: 0.9, why: 'low mastery' });
  } else {
    opts.push({ move: 'practice', score: 1, why: 'default practice' });
  }

  if (mode === 'gentle') opts = opts.filter((o) => o.move !== 'erroneous' && o.move !== 'transfer');
  if (mode === 'challenge') opts = opts.filter((o) => o.move !== 'worked' && o.move !== 'explain');
  if (opts.length === 0) opts.push({ move: 'practice', score: 1, why: `mode ${mode} fallback` });
  const top = Math.max(...opts.map((o) => o.score));
  return opts.map((o) => ({ ...o, score: o.score / top })).sort((a, b) => b.score - a.score);
}

/**
 * Item choice within a (skill, move): rank by expected information gain about the skill, then pick
 * uniformly among the top k ("randomesque" exposure control, from adaptive testing). Without it the
 * policy reuses the few most informative items and the rest of the bank never gets enough data to fit.
 * Returns [null] when no item fits: the host should generate content for the move.
 */
function selectItems(skillId: SkillId, move: Move, ls: LearnerState, ctx: PolicyContext, t: number): (ItemId | null)[] {
  const pool = ctx.catalog.itemsByPrimary.get(skillId) ?? [];
  const recent = new Set(sessionAt(ls, t, ctx.policy).recentItems);
  const k = ctx.consent.randomise ? Math.max(1, ctx.policy.scoring.itemTopK) : 1;
  for (const kind of MOVE_ITEM_KINDS[move]) {
    const cands = pool.filter(
      (i) => !i.isSentinel && i.kind === kind && !recent.has(i.id) && (move !== 'transfer' || i.isTransfer),
    );
    if (cands.length === 0) continue;
    const scored = cands
      .map((it) => ({ id: it.id, ig: itemInfoGain(ls, it, ctx.itemParams.get(it.id), t, ctx.cfg, skillId) }))
      .sort((a, b) => b.ig - a.ig || a.id.localeCompare(b.id));
    return scored.slice(0, k).map((x) => x.id);
  }
  return [null];
}

function nearTies<T>(xs: T[], score: (x: T) => number, eps: number, max: number): T[] {
  const sorted = [...xs].sort((a, b) => score(b) - score(a));
  if (sorted.length === 0) return [];
  const best = score(sorted[0]);
  return sorted.filter((x) => score(x) >= best - eps).slice(0, max);
}

export function evaluatePolicy(ls: LearnerState, ctx: PolicyContext, t: number): PolicyEvaluation {
  const { policy: pol, cfg, catalog } = ctx;
  const m = cfg.model;
  const sess = sessionAt(ls, t, pol);
  const reviewShare = sess.items > 0 ? sess.reviewItems / sess.items : 0;
  const capReached = sess.items >= pol.review.minItemsBeforeCap && reviewShare >= pol.review.cap;
  const sessionLog = {
    items: sess.items,
    reviewItems: sess.reviewItems,
    reviewShare,
    capReached,
    currentSkill: sess.currentSkill,
    dwell: sess.dwell,
  };
  const base = {
    learnerId: ls.learnerId,
    t,
    modelVersion: MODEL_VERSION,
    policyVersion: POLICY_VERSION,
    paramsHash: hashString(JSON.stringify({ cfg, pol })).toString(36),
    mode: ctx.mode,
    session: sessionLog,
  };

  // Tier 1: safety
  if (ctx.safetyHold || sess.consecutiveWrong >= pol.safety.consecutiveWrongBreak) {
    return {
      ...base,
      tier: 'safety',
      candidates: [],
      moveOptions: {},
      distribution: [{ skillId: null, move: 'break', itemId: null, itemDifficulty: null, prob: 1 }],
      randomised: false,
      reason: ctx.safetyHold
        ? 'Safety hold set by the host application.'
        : `${sess.consecutiveWrong} wrong in a row: offering a break before anything else.`,
    };
  }

  // Tiers 2-3: build candidates and gates
  const statuses = new Map<SkillId, MasteryStatus>();
  const status = (k: SkillId) => {
    let st = statuses.get(k);
    if (!st) {
      st = masteryStatus(peekSkill(ls, k, m), pol, m);
      statuses.set(k, st);
    }
    return st;
  };
  const candidates: CandidateLog[] = catalog.skills.map((def) => {
    const s = peekSkill(ls, def.id, m);
    const ms = status(def.id);
    const R = retrievability(s, t, cfg);
    let excludedBy: string | null = null;
    if (ctx.mode === 'review' && s.attempts === 0) excludedBy = 'mode: review covers practised skills only';
    if (!excludedBy && !ctx.challengePassed?.has(def.id)) {
      for (const p of def.prereqs) {
        const ps = peekSkill(ls, p, m);
        if (!status(p).mastered && availability(ps, t, cfg) < pol.readiness.prereqAvailability) {
          excludedBy = `prerequisite ${p} not ready`;
          break;
        }
      }
    }
    const items = (catalog.itemsByPrimary.get(def.id) ?? []).filter((i) => !i.isSentinel);
    let ig = 0;
    for (const it of items) ig = Math.max(ig, itemInfoGain(ls, it, ctx.itemParams.get(it.id), t, cfg, def.id));
    return {
      skillId: def.id,
      eligible: excludedBy === null,
      excludedBy,
      L: s.L,
      R,
      pLower: ms.pLower,
      pUpper: ms.pUpper,
      n: s.n,
      mastered: ms.mastered,
      due: isDue(s, t, cfg, pol),
      retentionLoss: s.attempts > 0 ? s.L * (1 - R) : 0,
      gain: expectedAvailabilityGain(s, t, cfg, pol.scoring.horizonDays),
      infoGain: ig,
      importance: catalog.importance.get(def.id) ?? 1,
      baseScore: null,
      switchFactor: null,
      score: null,
    };
  });

  const eligible = candidates.filter((c) => c.eligible);
  if (eligible.length === 0) {
    return {
      ...base,
      tier: 'none',
      candidates,
      moveOptions: {},
      distribution: [{ skillId: null, move: 'break', itemId: null, itemDifficulty: null, prob: 1 }],
      randomised: false,
      reason: 'No eligible skills under the current mode and prerequisites.',
    };
  }

  // Tier 4: due review, subject to the cap
  const due = eligible.filter((c) => c.due);
  let tier: Tier;
  let pool: CandidateLog[];
  if (due.length > 0 && !capReached) {
    tier = 'review';
    pool = due;
    const norm = minMax(pool.map((c) => c.retentionLoss * c.importance));
    pool.forEach((c, i) => (c.baseScore = norm[i]));
  } else {
    // Tier 5: expected gain + information gain
    tier = 'learning';
    pool = eligible;
    const wInfo = ctx.mode === 'explore' ? 2 * pol.scoring.wInfo : pol.scoring.wInfo;
    const g = minMax(pool.map((c) => c.gain * c.importance));
    const ig = minMax(pool.map((c) => c.infoGain));
    pool.forEach((c, i) => (c.baseScore = (g[i] + wInfo * ig[i]) / (1 + wInfo)));
  }

  // Stay / leave / return: switch cost in item-equivalents over a planned dwell
  const current = sess.currentSkill;
  const D = pol.dwell.planned;
  for (const c of pool) {
    let factor = 1;
    if (current && c.skillId !== current) {
      const cost = Math.max(
        pol.dwell.minSwitchCostItems,
        pol.dwell.switchCostItems - pol.dwell.confusabilityDiscount * catalog.confusability(current, c.skillId),
      );
      factor = D / (D + cost);
    }
    c.switchFactor = factor;
    c.score = (c.baseScore ?? 0) * factor;
  }

  const currentInPool = current ? pool.find((c) => c.skillId === current) : undefined;
  let choicePool = pool;
  let dwellNote = '';
  if (currentInPool && sess.dwell < pol.dwell.min) {
    choicePool = [currentInPool];
    dwellNote = ` Stayed on ${current}: dwell ${sess.dwell} < minimum ${pol.dwell.min}.`;
  } else if (currentInPool && sess.dwell >= pol.dwell.max && pool.length > 1) {
    choicePool = pool.filter((c) => c.skillId !== current);
    dwellNote = ` Left ${current}: dwell ${sess.dwell} reached maximum ${pol.dwell.max}.`;
  }

  const eps = pol.scoring.nearTieEpsilon;
  const tiedSkills = nearTies(choicePool, (c) => c.score ?? 0, eps, pol.scoring.maxTied);
  const randomiseSkills = ctx.consent.randomise && tiedSkills.length > 1;
  const skillChoices = randomiseSkills ? tiedSkills : [tiedSkills[0]];
  const pSkill = 1 / skillChoices.length;

  const moveOptions: Record<SkillId, MoveOption[]> = {};
  const distribution: ActionProb[] = [];
  let anyMoveRandomised = false;
  for (const c of skillChoices) {
    const s = peekSkill(ls, c.skillId, m);
    const opts = gridMoves(s, status(c.skillId), tier, ctx.mode, pol);
    moveOptions[c.skillId] = opts;
    const tiedMoves = nearTies(opts, (o) => o.score, eps, pol.scoring.maxTied);
    const randomiseMoves = ctx.consent.randomise && tiedMoves.length > 1;
    if (randomiseMoves) anyMoveRandomised = true;
    const moves = randomiseMoves ? tiedMoves : [tiedMoves[0]];
    for (const mv of moves) {
      const itemIds = selectItems(c.skillId, mv.move, ls, ctx, t);
      for (const itemId of itemIds)
        distribution.push({
          skillId: c.skillId,
          move: mv.move,
          itemId,
          itemDifficulty: itemId ? (ctx.itemParams.get(itemId)?.difficulty ?? null) : null,
          prob: pSkill / moves.length / itemIds.length,
        });
    }
  }

  const top = skillChoices[0];
  const fmt = (x: number) => x.toFixed(2);
  let reason =
    tier === 'review'
      ? `Review tier: ${top.skillId} recall estimated ${fmt(top.R)} (target ${pol.review.targetR}), retention loss ${fmt(top.retentionLoss)}. Review share ${sess.reviewItems}/${sess.items} under cap ${pol.review.cap}.`
      : `Learning tier: ${top.skillId} scored ${fmt(top.score ?? 0)} (availability gain ${fmt(top.gain)}, information ${fmt(top.infoGain)} bits).` +
        (due.length > 0 && capReached ? ` ${due.length} skill(s) due, but review cap ${pol.review.cap} reached.` : '');
  reason += dwellNote;
  if (randomiseSkills) reason += ` Randomised between ${skillChoices.map((c) => c.skillId).join(', ')} (scores within ${eps}).`;
  if (anyMoveRandomised) reason += ' Randomised between near-equal moves.';
  const firstMove = moveOptions[top.skillId]?.[0];
  if (firstMove) reason += ` Move: ${firstMove.move} (${firstMove.why}).`;

  return {
    ...base,
    tier,
    candidates,
    moveOptions,
    distribution,
    randomised: randomiseSkills || anyMoveRandomised,
    reason,
  };
}

/** Probability the policy assigns to a (skill, move) action. */
export function actionProb(ev: Pick<PolicyEvaluation, 'distribution'>, skillId: SkillId | null, move: Move): number {
  return ev.distribution.filter((d) => d.skillId === skillId && d.move === move).reduce((s, d) => s + d.prob, 0);
}

export function selectNext(ls: LearnerState, ctx: PolicyContext, t: number, rng: Rng): Decision {
  const ev = evaluatePolicy(ls, ctx, t);
  const draw = rng();
  let acc = 0;
  let chosen = ev.distribution[ev.distribution.length - 1];
  for (const d of ev.distribution) {
    acc += d.prob;
    if (draw < acc) {
      chosen = d;
      break;
    }
  }
  const decisionId = `${ls.learnerId}-${t}-${hashString(`${ls.learnerId}|${t}|${draw}`).toString(36)}`;
  const propensity = actionProb(ev, chosen.skillId, chosen.move);
  return { ...ev, decisionId, chosen, propensity, itemPropensity: propensity > 0 ? chosen.prob / propensity : 1, rngDraw: draw };
}
