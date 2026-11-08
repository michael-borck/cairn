# Adaptive model design log, 2026-11-09

- Status: Research log, not a decision
- Related: [Adaptive methods audit](../spec/adaptive-methods-audit.md), [ADR 0011](../adr/0011-incorporate-ledgers-research-prototype.md), [Ledgers prototype](../../research/ledgers/README.md)
- Raw transcript: [Cairn build session](transcripts/2026-11-06-cairn-build-session.md)

## Why this log exists

The adaptive model design thread moved through several stages: a broad adaptive-learning idea, a critique of stacked heuristics, a foraging metaphor, a smaller BKT-based model, a further critique, and a TypeScript implementation with a replay harness.

This log records the conclusions and the open questions. It does not preserve the raw chat. The raw chat is exploratory and would become a maintenance burden. If a verbatim transcript is needed later, put it under `docs/research/transcripts/` and mark it non-authoritative.

## Progression

### 1. Start with a dynamic adaptive engine

The initial idea was a system that tracks learner evidence, adapts difficulty, offers alternative pathways, and keeps the learner in control.

The useful parts were:

- Evidence over time, not one-shot placement.
- Difficulty and help as separate controls.
- Human override and explainability.
- AI optional.
- Content packs, not a fixed course.

### 2. The policy-drift critique

The first design accumulated independent heuristics: BKT, Elo, target success, mastery thresholds, review intervals, wrong-streak rules, help levels, hysteresis, and confidence sampling. Several were declared but not wired.

The important conclusion: use one learner model, one objective, and one controller. Do not let a dozen heuristics each claim a veto.

### 3. Cognitive Foraging

The metaphor: learning as foraging in a knowledge landscape. Skills are patches. Mastery is depletion. Review is regeneration. Transfer is moving to a new patch.

The metaphor is useful for communication. It is not a mechanism. The mechanism is a probabilistic learner model plus a stay, leave, or return decision.

### 4. The critique that changed the model

The second review made several corrections:

- Bernoulli variance is not additional uncertainty. Use an evidence count or a hierarchical posterior.
- Under fixed BKT, expected mastery gain is deterministic in `p`. Foraging for mastery gain collapses into a mastery threshold. Forage for information gain or retention instead.
- BKT has no forgetting. Add a half-life or retention model.
- Misconceptions and transfer need authoring and context-tagged items.
- Latency is confounded. Treat it as a weak flag.
- Sampling confidence is better than asking on every item.
- Replay shows different decisions, not better outcomes.

### 5. The minimal model

The implementable version uses:

- BKT-style mastery per skill.
- Item-specific slip and guess.
- Time-based forgetting with a half-life.
- Evidence count with decay.
- A confidence and accuracy grid that selects an action type.
- A mastery gate requiring evidence, a hard or transfer pass, and a delayed success.
- A review cap.
- A stay, leave, or return decision using availability gain and information gain.
- Decision logs with candidate values, propensities, and reasons.

### 6. The implementation

The Ledgers prototype implements the model and a replay harness in TypeScript with no runtime dependencies.

Verified at import:

- 19 tests pass.
- The simulator runs end to end.
- Prediction improves over a plain BKT baseline on simulated data.
- The self-check has full support and zero difference.
- The sample candidate policy is estimated slightly worse than the logging policy on delayed sentinel outcomes.

The prediction model is the trustworthy part. The controller is not validated.

## Accepted conclusions

- Prediction comes before policy comparison.
- One state model, one controller.
- Item difficulty belongs in the learner model, not only in the policy.
- Forgetting belongs in the model.
- Confidence belongs in calibration and action selection, not in the mastery update.
- Hints need an explicit convention.
- Multi-skill items need explicit evidence allocation.
- Decision logs must include propensities and enough parameter information to replay and refit.
- The production app should not adopt the research controller yet.

## Open questions

- Can the logging policy and model parameters be reconstructed from real Cairn logs?
- Does the prediction model beat BKT on real held-out learners?
- Which hint convention works for Cairn: hint as wrong, hint as separate observation, or hint-aided likelihood?
- Are the blame and forgetting-blame allocations exact enough to use for remediation?
- Can multi-skill allocation predict sentinel performance on secondary skills?
- Does the controller improve delayed retention in a randomised pilot?
- How much item exposure control is acceptable before it harms learning?
- What is the smallest model that keeps the prediction gain?

## Next steps

1. Add real Cairn log export in a bundle format.
2. Record full model and policy parameters, not only a hash.
3. Run the prediction report on real logs with author item difficulty.
4. Separate model comparison from policy comparison.
5. Run a small randomised pilot with near-tie exploration and delayed sentinels.
6. Only then decide whether to port any of the model into `packages/engine`.
