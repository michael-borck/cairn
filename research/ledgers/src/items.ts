/**
 * Item difficulty with shrinkage.
 *
 * Each item has one difficulty d that sets both slip and guess:
 *   slip_i = clamp(slipBase + a d),  guess_i = clamp(guessBase - b d)
 * Fit: replay the training learners with the current item params, recording for every scorable
 * attempt the skill-side term Q (prod of q_k, which does not depend on the item's own d).
 * For each item, solve sum_j P(correct | d, Q_j) = observed correct for d_hat by bisection
 * (P is non-increasing in d), then shrink toward the author rating:
 *   d_i = (kappa * d_author + N_i * d_hat) / (kappa + N_i)
 * Iterate a few times because learner states depend on item params.
 * Only first attempts are used, with outcome = correct and unassisted (see observedCorrect).
 */
import { ModelParams, PolicyParams } from './params';
import { ModelConfig, authorItemParams, newLearner, observedCorrect, predict, slipGuess, update } from './model';
import { Attempt, Item, ItemId, ItemParams } from './types';
import { clamp } from './stats';

/** First attempts are scored; the outcome is observedCorrect (a hint counts as not correct). */
export function isScorable(a: Attempt): boolean {
  return a.attemptNumber === 1;
}

export function groupByLearner(attempts: Attempt[]): Map<string, Attempt[]> {
  const g = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const list = g.get(a.learnerId);
    if (list) list.push(a);
    else g.set(a.learnerId, [a]);
  }
  for (const list of g.values()) list.sort((x, y) => x.t - y.t);
  return g;
}

export function authorParamsMap(items: Item[], m: ModelParams): Map<ItemId, ItemParams> {
  return new Map(items.map((it) => [it.id, authorItemParams(it, m)]));
}

export interface ItemFitResult {
  params: Map<ItemId, ItemParams>;
  iterations: number;
  itemsWithData: number;
}

export function fitItemDifficulties(
  items: Item[],
  trainAttempts: Attempt[],
  cfg: ModelConfig,
  pol: PolicyParams,
): ItemFitResult {
  const m = cfg.model;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const byLearner = groupByLearner(trainAttempts);
  let params = authorParamsMap(items, m);
  const kappa = pol.shrinkage.kappa;
  let itemsWithData = 0;

  for (let iter = 0; iter < pol.shrinkage.iterations; iter++) {
    // item -> list of skill-side terms Q and outcomes
    const obs = new Map<ItemId, { Q: number[]; correct: number }>();
    for (const [learnerId, list] of byLearner) {
      const ls = newLearner(learnerId, list[0]?.t ?? 0);
      for (const a of list) {
        const item = itemById.get(a.itemId);
        if (!item) continue;
        const ip = params.get(item.id);
        if (isScorable(a) && ip) {
          // Recover Q from the prediction: P = guess + span * Q.
          const p = predict(ls, item, ip, a.t, cfg);
          const span = 1 - ip.slip - ip.guess;
          const Q = span > 0 ? clamp((p - ip.guess) / span, 0, 1) : 0;
          const rec = obs.get(item.id) ?? { Q: [], correct: 0 };
          rec.Q.push(Q);
          if (observedCorrect(a)) rec.correct += 1;
          obs.set(item.id, rec);
        }
        update(ls, item, ip, a, cfg, pol);
      }
    }

    const next = new Map<ItemId, ItemParams>();
    itemsWithData = 0;
    for (const item of items) {
      const prior = authorItemParams(item, m);
      const rec = obs.get(item.id);
      if (!rec || rec.Q.length === 0) {
        next.set(item.id, prior);
        continue;
      }
      itemsWithData += 1;
      const N = rec.Q.length;
      const dHat = solveDifficulty(rec.Q, rec.correct, m);
      const d = clamp((kappa * prior.difficulty + N * dHat) / (kappa + N), m.difficultyMin, m.difficultyMax);
      next.set(item.id, { difficulty: d, ...slipGuess(d, m), nObs: N, source: 'fitted' });
    }
    params = next;
  }
  return { params, iterations: pol.shrinkage.iterations, itemsWithData };
}

function expectedCorrect(Qs: number[], d: number, m: ModelParams): number {
  const { slip, guess } = slipGuess(d, m);
  const span = 1 - slip - guess;
  let s = 0;
  for (const Q of Qs) s += guess + span * Q;
  return s;
}

function solveDifficulty(Qs: number[], observed: number, m: ModelParams): number {
  let lo = m.difficultyMin;
  let hi = m.difficultyMax;
  if (expectedCorrect(Qs, lo, m) <= observed) return lo;
  if (expectedCorrect(Qs, hi, m) >= observed) return hi;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (expectedCorrect(Qs, mid, m) > observed) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
