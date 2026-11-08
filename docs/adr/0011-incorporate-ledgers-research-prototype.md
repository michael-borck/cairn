# 0011. Incorporate Ledgers as a research prototype

- Status: Accepted
- Date: 2026-11-09
- Supersedes: none

## Context

The Three Ledgers design thread produced a TypeScript learner model and replay harness. It has a promising prediction model, exact propensities, a self-check, and full decision logging. It also has an unvalidated controller, a negative sample policy estimate, and a policy comparison that mixes model and policy changes.

The code is useful enough to preserve and test. It is not ready to replace the production policy in `packages/engine`.

## Decision

Import the prototype under `research/ledgers/` with an MIT licence.

- Keep it a private, standalone package. It is not part of the root npm workspace.
- Do not wire it into the Tauri app or the production engine yet.
- Trust the prediction report first. Treat the policy report as differences only until there is real-log prediction and randomised delayed outcomes.
- Preserve the original README, sample report, and provenance.
- Fix the `harness` script so it compiles before running.

## Consequences

The research history is preserved in Git, with source, tests, sample output, and provenance.

The prototype can evolve without destabilising the app. It also duplicates a second TypeScript package and requires a separate install and test run.

Production integration remains an explicit future decision. It requires a clean logging-policy record, real-log prediction, and a randomised pilot.

## Evaluation gate

Before any production integration:

1. The prediction model must beat the BKT baseline on held-out real logs.
2. Calibration must be acceptable.
3. The policy comparison must use the same item parameters for both arms.
4. The logging policy and model parameters must be reconstructible.
5. A small randomised pilot must show a credible delayed-retention benefit.

Until then, the prototype informs the design. It does not drive the learner experience.
