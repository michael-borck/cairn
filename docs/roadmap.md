# Roadmap

Committed phases. Uncommitted ideas live in [future-work.md](future-work.md).

## v1: pilot, 8 to 12 weeks

Outcome: one adult self-learner can import the Docker pack, take a diagnostic, work through adaptive sessions, see why each activity was chosen, and review progress.

Scope:

- Tauri v2 app with React and TypeScript.
- Engine package with BKT-lite, policy, review scheduler, and decision log.
- Pack schema and validator.
- Docker fundamentals pack: 3 modules, 12 skills, 60 items, 10 learner-run labs.
- Import from Markdown, PDF, DOCX, HTML, EPUB, and a lab repo.
- CLI/YAML authoring.
- SQLite storage, export, and import.
- AI off and assist.
- Mastery map, badges, optional challenge.
- Pilot with 10 to 20 adults, pre/post test and delayed retention.

Acceptance:

- AI-off mode works offline.
- Same state and events produce the same decisions.
- Every decision has a reason and evidence.
- Overrides are logged and do not corrupt mastery.
- Pack validation catches broken references and cycles.
- WCAG 2.2 AA.
- Learner data exports and imports cleanly.

## v1.5: content studio, 4 to 6 weeks

Outcome: an author can build and validate a pack without hand-editing every JSON file.

Scope:

- Local content studio.
- Skill graph editor.
- Item, hint, rubric, and misconception editors.
- Learner preview and simulated learner.
- Pack export and import.
- AI-assisted drafting with human approval.

## v2: community library, 6 to 8 weeks

Outcome: learners can browse, install, update, and remove reviewed packs without an account.

Scope:

- Separate static catalog repository.
- Catalog and artifact hashing.
- Install, update, and remove flows.
- Trust tiers and badges.
- CI validation and PR submission guide.
- Moderation checklist.
- Report and revocation path.
- Launch with first-party packs, then open submissions.

## v3: optional services

Only when a pilot or customer requires them:

- Signed completion records and verification.
- Optional encrypted sync.
- Teacher and cohort sharing with consent.
- LMS integration.
- Submission portal for non-technical creators.
