# Adaptive methods audit

- Status: Audit
- Date: 2026-11-09
- Scope: engine policy, learner model, and pack policy fields
- Code at time of writing: `packages/engine/src/policy.ts`, `packages/engine/src/engine.ts`, `packages/engine/src/types.ts`, `packages/content/src/schema.ts`
- Research prototype: [`research/ledgers`](../../research/ledgers/README.md)

## Summary

The active adaptive core is coherent enough for a pilot. It also has configuration drift: several policy settings exist in the schema and appear in the documentation, but the decision engine does not use them.

The main risk is not the algorithms. It is that the app promises more agency and more policy than the engine currently implements. The Easier, Harder, More help, and Less help controls are the clearest example.

## Methods that are active

| Method | What it does |
|---|---|
| BKT-lite per skill | Updates mastery after evidence. Uses fixed prior, learn, slip, and guess values. |
| Evidence weighting | Discounts hint-assisted, retried, AI-graded, and self-reported evidence. |
| Mastery bands | Low mastery gets explanation or worked example. Middle mastery gets guided practice. High mastery gets independent practice or a retention check. |
| Mastery-to-difficulty | Picks item difficulty near `1 + mastery * 4`. |
| Prerequisite gating | Checks prerequisite mastery and can step back to repair a gap. |
| Wrong-streak rule | Two misses switch to a worked example. Three misses trigger remediation. |
| Recent-item avoidance | Avoids repeating the same item when alternatives exist. |
| Explanation-to-practice | After an explanation has been seen, moves to practice instead of repeating it. |
| Leitner review | 1, 3, 7, 21, and 60 day intervals. A correct answer advances, a miss steps back. |
| Calibration tracking | Tracks Brier score, confident-wrong, and unsure-correct. Used by badges only. |
| Challenge mode | Optional harder activity for mastered skills. Updates mastery like practice. |
| AI hints and feedback | Advisory only. Never recorded as learner evidence. |

## Configuration that is not wired

These fields exist in the schema and are validated, but the policy does not use them:

- `targetSuccessMin` and `targetSuccessMax`. Difficulty selection uses mastery, not a predicted success rate.
- `hysteresis`. There is no observation window or cooldown before changing levels.
- `help.startLevelByMastery`, `help.escalateAfterWrong`, and `help.fadeAfterCorrect`. The UI has a hint ladder, but the policy does not choose help levels.
- `confidenceSampleRate`. The UI always offers a confidence choice instead of sampling roughly 20 percent of items.
- `difficultyElo`. The engine updates it, but item selection does not use it.
- `wrongStreak.similarItem`. The first wrong answer has no explicit similar-item rule.
- `availableMinutes` and `pathMode`. Accepted by the API, unused by the policy.
- `preferences.difficulty` and `preferences.help`. The Easier, Harder, More help, and Less help buttons update these values, but the policy does not read them. Those controls can appear to do nothing.

## Planned methods

These are in future work and should wait for pilot data:

- IRT or computerized adaptive testing.
- Deep knowledge tracing.
- Knowledge space theory.
- Contextual bandits or reinforcement learning.
- FSRS review scheduling.
- Per-skill fitted BKT parameters.
- Calibration-driven remediation.
- Goal planning with session time budgets.

BKT and the rule policy work without response data. IRT, DKT, and bandits need data. Adding them before a pilot would add complexity without evidence.

## Conflicts and tensions

1. **BKT mastery and Elo are two ability models.** Elo is updated but ignored. Choose BKT as the primary learner model. Keep Elo only as item calibration, or remove it.

2. **Mastery-to-difficulty and target success are two difficulty policies.** The engine uses mastery-to-difficulty. The target success band is only validation metadata. Pick one. If target success is the goal, use Elo or IRT to predict success and select into the band. Otherwise remove the target band from the policy surface.

3. **BKT mastery and Leitner review can disagree.** A skill can have high mastery but be due for review, or low mastery but a long interval. Set a priority order: overdue review first, then prerequisite gap, then mastery band. Use mastery to adjust review urgency, not to override a due review.

4. **Prerequisite threshold and mastery threshold are both 0.9.** That is strict. A learner can be blocked from a new skill for a long time. Use a separate readiness threshold, around 0.6 to 0.75, for prerequisites. Keep 0.9 for mastery.

5. **Wrong-streak rules and BKT both react to misses.** Without hysteresis, the engine can over-remediate. Require two consistent observations and a minimum number of items between level changes.

6. **Calibration and mastery can disagree.** Confident-wrong should probably override mastery and trigger remediation. Right now calibration only drives badges. Decide explicitly whether it is advisory or policy-driving.

7. **Recent-item avoidance can fight difficulty targeting.** Avoiding a recent item may select an item farther from the target difficulty. Keep recent-item avoidance as a soft preference, not a hard rule.

8. **Static hints and AI hints are different evidence channels.** Static hints reduce evidence weight. AI hints are not evidence. That is consistent, but the UI should make the distinction clear.

## Recommended policy cleanup

Do this before the pilot:

1. Wire `difficulty` and `help` preferences into item and help selection. Otherwise remove those override buttons until they work.
2. Choose BKT as the single mastery model. Remove Elo from selection or make it item-only.
3. Either implement the target success band or remove it from the policy.
4. Add hysteresis and a clear decision priority order.
5. Split prerequisite readiness from mastery threshold.
6. Decide whether calibration can change advancement or only badges and hints.
7. Add tests for override effects, hysteresis, and prerequisite readiness.

## Decision priority order to adopt

Suggested order for the next policy version:

1. Overdue review.
2. Prerequisite gap.
3. Repeated wrong-streak remediation.
4. Mastery band for the current skill.
5. Challenge or completion.

Every step should record a reason code and evidence. Preference overrides should modify the current decision, not just learner settings.

## Bottom line

The adaptive methods do not conflict fatally. The problem is that too many policy knobs are declared before they are wired. For the pilot, fewer methods that actually work will be more credible than a larger policy surface that only partly responds.
