> Research prototype, not production policy. Imported from the Three Ledgers design thread on 2026-11-09. See [PROVENANCE.md](PROVENANCE.md). The prediction model is the trusted part. The controller is not yet validated and the sample candidate policy is estimated slightly worse than the logging policy.

# ledgers

This package contains a learner model, a controller and a replay harness for the Three Ledgers pilot, written in TypeScript with no runtime dependencies.

```
npm install
npm test                  # 19 unit tests
npm run simulate          # synthetic data -> prediction report -> self-check -> policy report
npm run harness -- bundle.json [--self-check] [--candidate overrides.json] [--force]
```

## Where each requirement lives

| Requirement | Where | How |
|---|---|---|
| Prediction before policy | `harness.ts` | `comparePolicies` only accepts a report issued by `evaluatePrediction`, checked at runtime with a `WeakSet`. It refuses to run if acceptance failed, unless `force` is set. |
| Prediction metrics | `harness.ts` | Log loss, Brier score, AUC, ECE and 10-bin calibration on held-out learners. The candidate is compared with a base rate, a plain BKT baseline and two ablations. Results are also broken down by slice: multi-skill items, gap of one day or more, first attempt on a skill. |
| Item difficulty with shrinkage | `items.ts` | One difficulty per item sets both slip and guess. Each item's difficulty is fitted by matching expected to observed correct answers, then shrunk toward the author's rating with pseudo-count κ. |
| Delayed-success gating | `model.ts` `masteryStatus` | A skill counts as mastered only when all four hold: Beta lower bound ≥ 0.85, n ≥ 8, at least one non-easy or transfer pass, and at least one correct answer after a gap of a day or more. |
| Review cap | `policy.ts` | Due review wins only while review is under `review.cap` of the session's items. After that, due skills compete in the learning tier like everything else. |
| Multi-skill evidence allocation | `model.ts` | Noisy-AND model with an exact per-skill posterior. Blame, share and forgetting-blame are computed per skill and logged. |
| Full decision logging with propensities | `policy.ts` `Decision` | Each decision logs every candidate and its values, gate exclusions, move options, the full action distribution, the chosen action, its propensity and item propensity, the RNG draw, a params hash, the item difficulty used, and a plain-language reason. |

## The model

### Per-skill state

For each learner and skill, the model keeps:

- `L`: the probability the skill is acquired.
- `halfLifeDays`: how long until recall halves.
- `n`: the effective evidence count.
- `lastSeen`: when the skill was last practised.
- Gate counters: delayed successes and non-easy or transfer passes.

Retrievability is `R = 2^(-dt/halfLife)`.

### Item response (noisy-AND)

Each tagged skill k has weight w_k. When skill k is unavailable, it blocks success with probability w_k. So:

```
q_k = 1 - w_k (1 - L_k R_k)
P(correct) = guess_i + (1 - slip_i - guess_i) * Π q_k
```

### Exact posterior for each skill

Let Q₋ₖ be the product of the other skills' q values. Then:

```
P(c | learned_k) = guess + span · Q₋ₖ · (1 - w_k (1 - R_k))
P(c | not_k)     = guess + span · Q₋ₖ · (1 - w_k)
```

### Allocation terms (all logged)

- **share_k = Q₋ₖ · w_k · R_k** is how much this response can say about skill k. It is what gets added to the evidence count `n`. A skill that another skill probably blocked receives little evidence.
- **blame_k = P(skill k blocked success | wrong).**
- **forgotBlame_k = P(skill k was learned but not retrieved, and that blocked success | wrong).** Only this term shrinks the half-life.

### Update order

All posteriors are computed from the pre-update state before anything changes. Then, for each skill:

1. Decay the evidence count, then add new evidence.
2. Apply the posterior, tempered by the evidence weight ω (from hints and retries; never confidence).
3. Apply the learning transition, scaled by the tag weight w_k.
4. Update the half-life.
5. Update the gate counters and `n`.

### Hints count as not correct

A hint counts as "not correct", following the ASSISTments convention. The earlier review suggested down-weighting hinted attempts instead. In simulation, dropping them biased item fits toward "easy": learners ask for hints when they don't know, so the attempts that remain look easier than they are. See the findings below.

### Information gain

Information gain is expected entropy reduction in bits, computed with the same noisy-AND likelihoods as the update.

### Availability gain

Availability gain is the expected change in `L·R` at the horizon (default 7 days) from practising now. Because half-life growth scales with (1 − R), extra practice on a skill just practised yields little. This is what makes "depletion" real rather than a mastery threshold.

## The controller

The controller works through these tiers in order:

1. Safety and consent.
2. Learner mode.
3. Prerequisite readiness.
4. Due review, under the cap.
5. Availability gain plus information gain, each min-max normalised within the candidates, so no units are mixed.
6. Exploration, through near-tie randomisation.

**Switch cost.** Switching costs a number of item-equivalents of attention over a planned dwell D: `score_j × D/(D + c)`. The cost c is lower between confusable skills (shared misconception tags), which rewards interleaving.

**Dwell.** Minimum and maximum dwell stop the controller thrashing between skills or getting stuck on one.

**Near-ties.** Skills or moves within ε of the best are randomised uniformly, but only with consent. Items are picked uniformly among the 3 most informative, a technique from adaptive testing called randomesque exposure control.

**Propensities.** The full distribution over actions is returned, so propensities are exact.

**Moves.** The confidence × accuracy grid chooses the move. Confidence is sampled by the host and only ever read here; it never enters the mastery update.

## Data format (adapting existing logs)

```ts
interface DataBundle {
  skills: { id; prereqs: string[] }[];
  items: { id; kind; authorDifficulty; skills: { skillId; weight }[]; isTransfer?; isSentinel?; misconceptionTags? }[];
  attempts: { learnerId; itemId; t /* ms */; correct; hintsUsed; attemptNumber; confidence?; decisionId? }[];
  decisions?: Decision[];  // from selectNext; omit for legacy logs
}
```

**Legacy logs** from a fixed-rule engine have no propensities. The harness still runs the prediction report, which is the part you can trust today. The policy report then shows differences only, and says why. If decisions are logged with propensity 1 everywhere, the value estimate is withheld, because a policy that never explored gives no support for any other action.

**Seeding half-lives from Leitner boxes.** `halfLifeFromInterval(intervalDays, targetR)` converts a box interval into a starting half-life, so the old and new schedulers agree on day one.

## What the simulated run showed

These results come from 300 synthetic learners over 24 days: about 57k attempts and 52k decisions. The simulator shares the model's functional form, so the numbers show that the code works. They are not evidence that the theory works.

### Prediction

| Model | Log loss | ECE |
|---|---|---|
| Plain BKT baseline | 0.554 | 0.072 |
| Author difficulty + forgetting | 0.460 | 0.019 |
| Fitted difficulty + forgetting + multi-skill (candidate) | 0.452 | 0.008 |

Most of the gain comes from forgetting and difficulty. On attempts after a gap of a day or more, log loss drops from 0.826 to 0.590.

### Hint handling

The first version dropped hinted attempts, which biased fitted items toward "easy". Treating a hint as "not correct" reduced much of that bias.

### Item fitting

- **Without shrinkage, the fit was worse than the author ratings.** RMSE against the planted truth was 0.96, against 0.47 for author ratings. Sparse items hit the bounds, and plugging in estimated learner states attenuates differences between items.
- **With κ = 20, the fit roughly ties the author ratings on recovering the planted values,** but it still improves prediction.
- **Exposure control was needed.** Without it, the controller reused a few items and much of the bank got almost no data.
- **The proper next step is joint EM fitting** (forward-backward over hidden states) rather than plug-in fitting.

### Multi-skill allocation

Multi-skill allocation barely moved next-response log loss: 0.3296 to 0.3291 on multi-skill items. Its value is in assigning blame to the right skill, which next-response prediction measures weakly. Add a dedicated check: predict sentinel performance on secondary skills.

### Self-check

Replaying the logging policy against its own logs gave full support, ESS equal to n, and a value difference of 0.000. That confirms the propensity and IPS (inverse-propensity weighting) machinery works.

### Value estimate

The value estimate uses self-normalised IPS on delayed sentinel correctness (4 to 9 days after each decision). Its confidence interval comes from a bootstrap that resamples whole learners rather than individual decisions, because decisions from one learner share sentinel outcomes.

## Not in this module yet

- The misconception hypothesis ledger: a discrete posterior over named misconceptions.
- Latency normalisation.
- Fitting the global learner parameters (`pInit`, `learn`, half-life constants) and per-skill parameters with hierarchical priors.
- Multi-step lookahead.

All parameters in `params.ts` are placeholders. `PolicyParams` holds product policy, not science.
