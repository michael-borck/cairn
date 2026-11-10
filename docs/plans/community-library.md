# Community library plan

- Status: Started after the adaptive scaffold work
- Catalog: https://github.com/michael-borck/cairn-packs
- Site: https://michael-borck.github.io/cairn-packs/
- Pattern: static catalog, PR submissions, local install
- Reference: Lorekeeper Packs

## Goal

Let learners discover and install packs without an account, while keeping the local library as the source of truth.

The store is discovery. The app is the runtime. A downloaded pack is copied into the local library and works offline afterwards.

## First slice

- [x] Separate `cairn-packs` repository.
- [x] Static catalog with SHA-256 hashes.
- [x] First-party Docker and Git `.learnpack` artifacts.
- [x] Catalog verifier and submission validator.
- [x] CI validation workflow.
- [x] Static catalog site.
- [x] Cairn catalog fetch and install flow (SHA-256 verified, local install).
- [ ] Signing and revocation.
- [ ] Open submissions.

## Shape

Separate repository: `cairn-packs`.

```text
cairn-packs/
├── catalog/
│   ├── index.json
│   └── packs/<pack-id>.json
├── packs/<pack-id>/<version>.learnpack
├── submissions/<pack-id>/
│   ├── pack.learnpack
│   └── submission.json
├── templates/submission.json
├── scripts/validate_pack.mjs
├── POLICY.md
├── CONTRIBUTING.md
└── .github/workflows/validate.yml
```

The catalog is static JSON. The app fetches it, downloads a pack, verifies the SHA-256 hash, validates the pack, then installs it locally. Signatures are still future work.

## Submission flow

1. Author builds a pack in Cairn.
2. Export the `.learnpack` and run local validation.
3. Add `submissions/<pack-id>/pack.learnpack` and `submission.json`.
4. Run `node scripts/validate_pack.mjs`.
5. Open a pull request. CI runs the same validator.
6. A maintainer reviews licence, provenance, safety, accuracy, and accessibility.
7. The pack is signed and added to the catalog.
8. A separate deploy rebuilds the static site.

A merged PR is not live until the catalog deploy completes.

## Submission metadata

```json
{
  "packId": "docker-fundamentals",
  "title": "Docker Fundamentals",
  "author": "Michael Borck",
  "contact": "michael@borck.dev",
  "licence": "CC-BY-4.0",
  "version": "0.1.0",
  "description": "A hands-on introduction to containers.",
  "changes": "Initial pack.",
  "status": "submitted",
  "trust": "reviewed"
}
```

## Trust tiers

- **Official**: first-party, signed, maintained.
- **Reviewed**: human-reviewed for licence, safety, accuracy, and accessibility.
- **Community**: schema and safety validated, not accuracy-reviewed.
- **Local**: imported by the learner, never uploaded.

The app shows the tier. AI-assisted modes can be restricted for unreviewed packs.

## Validation

The validator checks:

- pack schema and version
- stable pack ID and semantic version
- licence, source, and changelog
- unique skill and item IDs
- prerequisite acyclicity
- answer keys and rubric references
- hint levels and no answer leaks at level 1
- lab commands and checks
- no external media except allowlisted hosts
- no free-form prompts
- pack size cap
- content hash
- optional signature

## Safety for Cairn packs

Cairn packs are not inert. They contain hints, prompts, lab instructions, and AI boundaries.

- No free-form system prompts. The engine owns templates.
- AI-generated content is labelled and requires review.
- Labs are learner-run text in v1. The app does not execute pack code.
- If app-executed labs are added, they become a separate trust tier with a sandbox.
- NSFW, hate, harassment, dangerous instructions, and copyrighted material without permission are rejected.
- Prompt injection, license, and lab checks are automated where possible and reviewed by a human.

## Local library

- The app shows only packs the learner added.
- Adding a pack copies it into local storage.
- Updates are explicit and preserve learner progress by stable skill ID.
- Export and delete are always available.
- No learner data is sent to the catalog.

## Accounts

No accounts in v1. GitHub pull requests are the submission auth and review queue.

If a submission portal is needed later:

- email magic link or GitHub OAuth, not passwords
- rate limits and spam protection
- moderation queue
- creator profiles and revocation

Do not build this until the PR flow is a bottleneck.

## Ranking

No free-text reviews. No leaderboard.

Start with:

- curated featured packs
- categories and tags
- verified completion counts later
- report and takedown

## Launch plan

1. First-party packs only.
2. Static catalog and install flow.
3. Open reviewed PR submissions.
4. Add signing and revocation.
5. Add creator guide.
6. Add popularity counts only if the catalog grows.
