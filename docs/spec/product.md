# Cairn product spec v0.1

## Summary

Cairn is a local-first adaptive learning engine for self-directed adults. It imports notes, textbooks, and labs, builds a skill map, diagnoses the learner, and adapts difficulty, help, and review. Every decision is visible and overridable. AI is optional.

## Audience

Primary: adult self-learners who want to learn a practical subject without an account or a fixed course path.

Later: university, workplace, and K12 content packs. The engine is audience-agnostic. Content packs and policy presets carry the differences.

## Problem

Most adaptive platforms are cloud-first, account-based, and opaque. They decide the path, keep the data, and make AI mandatory. Learners cannot easily bring their own material or see why the system chose the next activity.

## Principles

1. Learner agency. The learner can see why and override.
2. Explainable adaptation. Every decision has evidence.
3. Local-first. No account is required to learn.
4. Portable content. Packs can be imported, exported, and shared.
5. Optional AI. AI off is a complete mode.
6. Local-first core, optional cloud services.

## Core loop

1. Import a content pack or your own material.
2. Take a short diagnostic or start with a goal.
3. Work through an activity selected by the engine.
4. The engine records evidence and updates mastery.
5. The learner sees the reason and can adjust difficulty, help, AI, or path.
6. Review items return on a spaced schedule.
7. The mastery map shows progress and gaps.

## Scope for v1

- Tauri v2 desktop app with React and TypeScript.
- TypeScript engine with BKT-lite, rules, review scheduling, and decision logs.
- One content pack: Docker fundamentals.
- Import from Markdown, PDF, DOCX, HTML, EPUB, and a lab repo.
- Learner-run Docker labs, not app-executed containers.
- CLI/YAML authoring and validation.
- AI off and assist modes.
- Local SQLite storage, export, and import.
- Mastery map, badges, and optional challenges.
- Pilot with 10 to 20 adults.

## Out of scope for v1

- Community library and submissions.
- Authoring GUI.
- App-executed labs.
- Accounts, sync, teacher dashboards, cohort analytics.
- Credentials and verification.
- LMS integration.
- Payments and marketplace.
- Mobile.
- Social feeds or leaderboards.

## Adaptation model

- Per-skill BKT-lite mastery estimate.
- Item difficulty from author rating and response data.
- Target success band of 75 to 85 percent.
- Wrong-answer rules: similar item, switch representation, prerequisite step-back, concept repair.
- Help levels: none, nudge, hint, worked step, full solution.
- Review intervals: 1, 3, 7, 21, 60 days.
- Confidence sampling on roughly one in five items.
- Hysteresis to prevent oscillation.

## Agency

- Difficulty: gentle, standard, challenge, auto.
- Help: none, nudge, hint, walkthrough, auto.
- AI: off, assist, full.
- Path: auto, suggest, manual.
- "Why this?" on every decision.
- One-click override.
- "I know this" starts a challenge, not an automatic skip.
- Manual mode warns about prerequisites but does not block.

## Gamification

- Mastery map with fog and review rings.
- Weekly goal set by the learner.
- Forgiving streak with grace days.
- Behaviour badges: explain it back, comeback, help-seeker, calibrated, deep diver.
- Optional module boss challenge with no penalty.
- No leaderboard, loss aversion, energy system, or loot boxes.

## Success measures

- Pre/post learning gain.
- Delayed retention at one week.
- Time to mastery.
- Completion rate.
- Hint dependence.
- Confidence calibration.
- Override rate and satisfaction with explanations.
- Return rate.

## Non-negotiables

- AI-off mode works offline.
- Same state and events produce the same decisions with AI off.
- Every decision has a reason and evidence.
- Learner data can be exported and deleted.
- Content packs validate before import.
- WCAG 2.2 AA.
- No secrets or learner data in the repository.
