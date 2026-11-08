# Future work

Uncommitted ideas. Each item needs a trigger before it becomes roadmap work.

## Deferred by design

| Idea | Why deferred | Trigger to revisit |
|---|---|---|
| App-executed Docker labs | Sandboxing, cross-platform runners, security review | Learners ask for in-app labs and v1 pilot proves demand |
| Authoring GUI | 4 to 6 weeks on its own | Pack format stable and external authors appear |
| Cloud sync | Multi-device conflicts, accounts, encryption | Learners use two devices regularly |
| Teacher dashboards | Accounts, consent, cohort data, privacy | A school or workplace pilot pays for it |
| Cohort analytics | Same as above, plus aggregation and retention policy | Institutional pilot |
| Credentials and verification | Identity, assessment integrity, revocation | Learners need proof for employers |
| LMS integration | LTI, rostering, grade passback | An institution requires it |
| Marketplace and payments | Tax, payouts, refunds, fraud, KYC | Free community library has sustained demand |
| Mobile app | App stores, background sync, smaller screens | Desktop pilot retains learners |
| Social features | Moderation and noise | Learners ask for study groups, not feeds |
| Localization | Schema and UI work | Non-English packs appear |
| Code items and runners | Execution safety | Programming packs become a priority |
| Pack signing and revocation | Key management, CI | Community submissions open |
| Submission portal | Auth, spam, moderation queue | Non-technical creators want to submit |
| Ratings and reviews | Moderation and gaming | Catalog is large enough to need ranking |
| Popularity counts | Needs a small service or static workaround | Catalog has enough packs to need discovery help |
| [Interactive fiction with Ink](ideas/interactive-fiction-ink.md) | Story runtime, evidence mapping, state versioning | v1.5 spike after item and lab formats are stable |

## Algorithms and research

| Idea | Why deferred | Trigger |
|---|---|---|
| IRT or CAT | Needs response data for calibration | Enough item responses to fit |
| Deep knowledge tracing | Data hungry and opaque | Large opt-in dataset and a need for better prediction |
| Knowledge space theory | Requires a complete prerequisite model | Pack graph is mature |
| Contextual bandits or RL | Hard to explain and easy to mis-tune | Explainable policy is stable and data supports it |
| FSRS review scheduling | More parameters than v1 needs | Review data shows Leitner is too coarse |
| Federated or local model training | Complex and expensive | Privacy-preserving personalization becomes a priority |
| [Three Ledgers prototype](../research/ledgers/README.md) | Research code and offline harness | Real-log prediction, then a randomised pilot |

## Product ideas

- Learner-held verifiable credentials with selective disclosure.
- Learner-initiated progress reports for teachers, instead of continuous telemetry.
- Study circles with shared packs and no central learner database.
- "Bring your own model" presets for Ollama, LM Studio, and OpenAI-compatible endpoints.
- Content packs for workplace compliance with policy presets.
- Accessibility-first item types, including audio and captioned video.
- Offline pack bundles for low-connectivity settings.
- A pack authoring guide with worked examples and a validation checklist.
- Branching scenarios and interactive fiction for incident response, ethics, and communication practice. See [the Ink idea](ideas/interactive-fiction-ink.md).

## Open questions

- How much adaptation is too much? Where should the engine stop and let the learner choose?
- Which evidence is worth collecting without becoming surveillance?
- How should confidence calibration change the policy?
- When does representation switching help, and when does it confuse?
- How much does the learner need to understand the model to trust it?
- What is the smallest useful community library?
