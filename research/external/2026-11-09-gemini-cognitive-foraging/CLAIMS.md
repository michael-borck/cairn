# Claims to verify

This is a checklist for the Gemini Deep Research document. None of these claims are established by the document alone.

| Claim | Current status | What would verify it |
|---|---|---|
| Wayfinder MPC beats BKT + SM-2 by 2.56x on 14-day delayed mastery | Unverified. Cited to reference 4, `unknown_url`. | Code, data, seeds, and a reproducible benchmark. |
| Wayfinder MPC beats baselines by 7.81x on novel-context transfer | Unverified. Same citation problem. | A held-out transfer task and a reproducible analysis. |
| Wheel-spinning falls from 90% to 17% of steps | Unverified. Same citation problem. | Definition of wheel-spinning, logs, and an independent replay. |
| Beta-BKT is a drop-in upgrade to BKT | Not established. A Beta belief is not the same model as BKT's hidden Markov state. | A precise model specification and comparison on real logs. |
| Three-step MPC is worth the complexity | Not established. The document's own numbers are synthetic. | An ablation against a one-step controller on real logs, then a pilot. |
| Criticality is a mechanism, not a metaphor | Unsupported as a mechanism here. | A testable definition and a measurable prediction. |
| Immunology is a mechanism for misconception repair | Useful metaphor. The mechanism is contrast cases and spaced exposure. | A misconception-repair experiment with delayed outcomes. |
| Hypercorrection and contrast cases improve misconception repair | Plausible and supported in the broader literature. The document's specific implementation is untested. | A controlled study with tagged misconceptions and delayed sentinel items. |
| Transfer coupling matrices predict novel-context performance | Unverified. | Context-tagged items and held-out transfer probes. |
| Learner mode and open learner model improve agency | Plausible, not established by this document. | A pilot with consent, overrides logged, and satisfaction/agency measures. |
| LLMs should not control policy | Strong design position, consistent with Cairn's ADRs. | Not an empirical claim; keep it as a product constraint. |

## What is worth mining

- Productive surprise grid using accuracy, confidence, and normalized latency.
- Hypercorrection window and contrast cases for confident errors.
- Transfer probes and context-tagged items.
- Open learner model and calibration display.
- Help Tutor style help-seeking profile.
- Review as patch regeneration rather than a separate scheduler.
- Cognitive apprenticeship roles: observer, guided, independent.
- Real option value for prerequisite and downstream skills.
- Explicit guardrails: one controller, AI not policy, engagement not the objective, do not hide trade-offs.

## What conflicts with the disciplined path

- Seven-dimensional state and Beta-BKT are more than the current minimal model can validate.
- Three-step MPC and a multi-term ETL/UA objective were explicitly deferred until a simpler controller shows signal.
- The benchmark claims are synthetic and uncited in a usable way.
- The borrowed lenses are communication devices, not mechanisms.

## Verdict

Use this document as an idea quarry and a communication artifact. Do not use it as evidence, a specification, or a roadmap commitment.
