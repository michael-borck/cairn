# Acknowledgments

Cairn is not a new theory of learning. It is a local-first, learner-owned workbench built on decades of work in intelligent tutoring, mastery learning, spaced repetition, psychometrics, and AI-assisted education.

This file records the prior art and the projects that shaped the design.

## Direct lineage

- **Study Buddy**: the local-first Electron tutor that supplied the shell, provider abstraction, privacy posture, and teaching strategies. Cairn started as an experiment next to Study Buddy.
- **Llama Tutor**: the open-source chat tutor that Study Buddy is based on. It demonstrated how small a useful AI tutor can be.
- **OATutor**: the closest open-source prior art for an adaptive tutor. Cairn borrows the BKT mastery idea, skill/problem pools, hints and scaffolds, course plans, mastery views, and the research mindset. OATutor's content library is math-heavy; Cairn focuses on self-directed adults, practical labs, and portable packs.
- **pyBKT**: the open-source Bayesian Knowledge Tracing library used for offline fitting and research.
- **BKT, PFA, IRT, CAT, and Knowledge Space Theory**: the learner-model and item-selection traditions Cairn draws on. Cairn uses a small BKT-lite model, not a new one.
- **Spaced repetition**: the review tradition behind Anki, SuperMemo, FSRS, and Leitner boxes. Cairn uses a half-life retention model and a review cap.
- **Lorekeeper and Lorekeeper Packs**: the static, PR-curated pack library pattern. Cairn's planned community library follows the same shape: submissions, validation, review, signing, and a local library that is the source of truth.
- **Three Ledgers and the Ledgers research prototype**: the evidence-weighted learner model and replay harness in `research/ledgers`.

## Open-source projects worth knowing

| Project | What it is | What Cairn borrows |
|---|---|---|
| OATutor | Open-source adaptive tutor with BKT and curated content | Skill/problem model, hints and scaffolds, mastery view, research hooks |
| pyBKT | BKT fitting library | Offline parameter fitting |
| Open edX | Open LMS with adaptive XBlocks | LTI and institutional deployment patterns |
| Moodle | Open LMS with adaptive quiz and lesson branching | Simple branching and retry rules |
| Oppia | Open branching lesson platform | Accessible authoring and learner-facing explanations |
| Llama Tutor | Open-source AI tutor | Small, approachable AI tutor shell |

## Proprietary systems used as reference

- ALEKS: Knowledge Space Theory, diagnostic placement, mastery pie.
- Knewton Alta: prerequisite remediation and adaptive practice.
- Area9 Rhapsode: confidence, misconception, and four-dimensional learning.
- Duolingo: difficulty tuning, streaks, and a consumer-grade learning loop.
- Khan Academy and Khanmigo: mastery paths and AI-assisted tutoring.

Cairn does not copy their code or content. These systems are reference points for patterns.

## What Cairn does not claim

- It did not invent BKT, mastery learning, spaced repetition, adaptive testing, prerequisite graphs, or AI tutoring.
- It is not a new learning theory.
- It is not a replacement for a school LMS.
- It is not a finished marketplace or credential issuer.

## What Cairn is trying to combine

- Local-first, private by default.
- Learner-owned content: notes, textbooks, labs, and packs.
- Visible adaptation with reasons and overrides.
- AI optional and subordinate to a deterministic policy.
- Open, portable content packs.
- Research-grade decision logs and a replay harness.

The combination is the contribution. The individual methods are inherited.
