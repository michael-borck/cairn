# Adaptive v0.2 implementation plan

- Status: Phase 1 complete, Phase 2 next
- Date: 2026-11-09
- Related: [Adaptive methods audit](../spec/adaptive-methods-audit.md), [Ledgers prototype](../../research/ledgers/README.md), [Research log](../research/2026-11-09-adaptive-model-design.md)

## Goal

Make Cairn feel adaptive when the learner turns adaptation on, without adding an opaque or over-engineered controller.

The learner should notice three things:

1. The next activity changes because of their answer.
2. The help level changes when they ask for more or less help.
3. The system can explain the change in one sentence.

## Principles

- One learner model, one controller.
- Every visible control must be wired to a real decision.
- Auto by default, with visible reasons and one-click override.
- Manual mode must be genuinely manual, not decorative.
- Every decision is logged with enough data to replay and refit.
- Research models stay in `research/ledgers` until real logs support them.

## Phase 1: wire the controls

### Engine

- Add `helpLevel` to `Decision`.
- Read `preferences.difficulty` when selecting items.
- Read `preferences.help` when computing `helpLevel`.
- Make Easier, Harder, More help, and Less help change the next decision.
- Keep the existing override buttons but make them real.

### App

- Add an Adaptive mode control: Auto and Manual.
- Auto uses the controller and explains its choice.
- Manual shows an activity picker grouped by skill.
- Manual recording updates mastery but does not auto-advance.
- The hint ladder respects `decision.helpLevel`.
- Hide hint controls when help level is 0.

### Acceptance

- Easier selects an easier item than Harder for the same learner state.
- More help raises `helpLevel`; Less help lowers it.
- Manual mode lets the learner choose an item directly.
- Auto mode advances after evidence; manual mode returns to the picker.
- A learner who turns adaptation off still has a usable linear/manual path.
- Tests cover difficulty bias, help level, and manual mode behavior.

## Phase 2: learner model v0.2

- Add evidence count to `SkillState`.
- Add half-life or retention state.
- Add item difficulty influence to evidence.
- Add mastery gate: evidence count, lower bound, hard or transfer pass, delayed success.
- Add review cap.
- Add dwell and hysteresis.
- Keep the model deterministic and explainable.

## Phase 3: research lab integration

- Export Cairn events to the Ledgers bundle format.
- Record model and policy parameters, not only a hash.
- Run prediction first: log loss, Brier, calibration, held-out learners.
- Compare policies only with the same item parameters.
- Add a randomised near-tie option for future pilots.

## Phase 4: pilot

- 10 to 20 adult learners.
- Pre/post and delayed retention.
- Transfer probes.
- Hint dependence, calibration, override rate, return rate.
- Think-aloud on whether the adaptation feels understandable.

## Non-goals

- Full POMDP or three-step MPC in the app.
- Regime-switching learner models in production.
- A community store or credentials.
- Optimising engagement as the primary objective.
- AI choosing the path.

## Current status

- [x] Implementation plan written.
- [x] Difficulty and help preferences wired into the engine.
- [x] Adaptive Auto and Manual modes in the app.
- [x] Hint ladder respects the decision help level.
- [x] Tests and build verification.
