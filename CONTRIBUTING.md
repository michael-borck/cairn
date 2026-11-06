# Contributing to Cairn

Cairn is in the specification phase. Small, focused changes are easier to review than broad rewrites.

## Decisions

Architecture decisions live in `docs/adr/`. To propose a decision:

1. Copy `docs/adr/template.md` to `docs/adr/NNNN-short-title.md`.
2. Set status to `Proposed`.
3. Open a pull request.
4. Once accepted, set status to `Accepted` and add it to the index.

Do not rewrite an accepted ADR. Add a new ADR that supersedes it.

## Content packs

- Every pack needs a licence and source.
- Do not submit copyrighted material you do not have rights to redistribute.
- Do not include free-form system prompts. The engine owns prompt templates.
- Labs are learner-run in v1. Do not add app-executed code.
- Media must be local to the pack or from an allowlisted host.
- Packs must pass the validator before submission.

## Code

- TypeScript for the engine, app, and CLI.
- Python for offline fitting and experiments.
- Keep the engine free of I/O. Storage and AI are adapters.
- Prefer small commits with a clear reason.

## Security

Do not commit secrets, API keys, learner data, or private content. Report security issues privately to the maintainer rather than opening a public issue.
