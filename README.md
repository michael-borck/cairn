# Cairn

A local-first adaptive learning engine for people who learn on their own.

Cairn imports your notes, textbooks, and labs, builds a skill map, diagnoses where you are, and adapts difficulty, help, and review. Every decision is visible and overridable. AI is optional.

Status: specification phase. The engine, desktop app, and first Docker content pack are next.

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
docs/
  adr/          architecture decisions
  spec/         product, pack schema, engine contract
  roadmap.md
  future-work.md
```

## Documentation

- [Product spec](docs/spec/product.md)
- [Pack schema v0.1](docs/spec/pack-schema-v0.1.md)
- [Engine contract v0.1](docs/spec/engine-contract-v0.1.md)
- [Architecture decisions](docs/adr/README.md)
- [Roadmap](docs/roadmap.md)
- [Future work](docs/future-work.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Decisions go through ADRs. Content packs must carry a licence and must not include copyrighted material you do not have rights to redistribute.

## Licence

MIT. See [LICENSE](LICENSE).
