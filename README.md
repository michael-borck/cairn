# Cairn

A local-first adaptive learning engine for people who learn on their own.

Cairn imports your notes, textbooks, and labs, builds a skill map, diagnoses where you are, and adapts difficulty, help, and review. Every decision is visible and overridable. AI is optional.

Status: content schema, engine core, CLI, Docker and Git packs, and a Tauri app with SQLite storage, folder import, AI controls, history, a review calendar, form-based pack authoring, material import, AI practice generation, badges, optional challenges, and a working session view. Pilot packaging and evaluation are next.

## What is built

- `@cairn/content`: Zod schemas for packs, items, rubrics, labs, and policy, plus cross-field validation.
- `@cairn/engine`: BKT-lite, review scheduling, next-activity policy, decision explanations, learner state, and an in-memory storage adapter.
- `@cairn/cli`: validate, inspect, and simulate packs against the real engine.
- `@cairn/desktop`: Tauri v2, React, and TypeScript app with SQLite storage, folder import, session view, mastery map, badges, optional challenges, hint ladder, due review, review calendar, recent history, local Ollama AI controls, overrides, form-based pack authoring, Markdown/HTML/DOCX/EPUB/PDF import, and AI-assisted practice generation.
- Tests for schema validation, BKT, review scheduling, policy decisions, learner export, import, and deterministic simulation.

## Try it

```bash
npm test
npm run typecheck
npx tsx apps/cli/src/index.ts validate content-packs/example/pack.json
npx tsx apps/cli/src/index.ts inspect content-packs/example/pack.json
npx tsx apps/cli/src/index.ts simulate --pack content-packs/example/pack.json --learners 20
```

## Why Cairn

Most learning platforms decide the path for you and keep your data on their servers. Cairn does the opposite.

- Local-first, with no account required.
- AI off is a first-class mode, not a degraded one.
- The learner can see why the engine chose an activity and override it.
- Content packs are portable and can be authored by anyone.
- A static community library can distribute packs without a central runtime.

## Principles

1. The learner stays in control.
2. Adaptation must be explainable.
3. Privacy is a product feature, not a policy page.
4. Content is portable and versioned.
5. AI is a tool, not the teacher.
6. Local-first core, optional cloud services.

## Planned structure

```
apps/
  desktop/      Tauri v2 and React
  cli/          validate, simulate, session
packages/
  engine/       pure TypeScript learner model, policy, scheduler
  content/      schema, validator, importers
  storage/      SQLite adapter
  ui/           shared React components
content-packs/
  docker-fundamentals/
research/
  ledgers/      evidence-weighted model and replay harness
docs/
  adr/          architecture decisions
  spec/         product, pack schema, engine contract
  ideas/        unscheduled concepts
  roadmap.md
  future-work.md
```

## Documentation

- [Product spec](docs/spec/product.md)
- [Pack schema v0.1](docs/spec/pack-schema-v0.1.md)
- [Engine contract v0.1](docs/spec/engine-contract-v0.1.md)
- [Adaptive methods audit](docs/spec/adaptive-methods-audit.md)
- [Architecture decisions](docs/adr/README.md)
- [Roadmap](docs/roadmap.md)
- [Future work](docs/future-work.md)
- [Interactive fiction with Ink](docs/ideas/interactive-fiction-ink.md)
- [Adaptive model research log](docs/research/2026-11-09-adaptive-model-design.md)
- [Cairn build session transcript](docs/research/transcripts/2026-11-06-cairn-build-session.md)
- [Ledgers research prototype](research/ledgers/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Decisions go through ADRs. Content packs must carry a licence and must not include copyrighted material you do not have rights to redistribute.

## Licence

MIT. See [LICENSE](LICENSE).
