# Cairn CLI

Headless tools for authors and policy testing.

```bash
# From the repo root
npx tsx apps/cli/src/index.ts validate content-packs/example/pack.json
npx tsx apps/cli/src/index.ts inspect content-packs/example/pack.json
npx tsx apps/cli/src/index.ts simulate \
  --pack content-packs/example/pack.json \
  --learners 50 \
  --seed 1
```

Or through the workspace script:

```bash
npm run cli --workspace @cairn/cli -- validate ../../content-packs/example/pack.json
```

Commands:

```
cairn validate <pack.json|pack-dir> [--strict]
cairn inspect <pack.json|pack-dir>
cairn simulate --pack <pack.json|pack-dir> [--learners 20] [--seed 1]
               [--max-steps 400] [--json]
cairn ledgers <cairn-export.json...> [--out bundle.json]
```

A pack path can be a single JSON file or a directory containing
`manifest.json`, `curriculum.json`, `items.json`, `rubrics.json`,
`misconceptions.json`, `labs.json`, and `policy.json`.

`validate` prints errors and warnings. `--strict` treats warnings as failures.

`simulate` runs synthetic learners against the real policy and engine. Each
learner has a latent ability, answers practice items with a probability based on
item difficulty, and reads explanations and worked examples. The report shows
completion rate, average steps, average mastery, max-step hits, and action
counts. The same seed and start time produce the same report.

The CLI is also the language-agnostic surface for a future Python client.


`ledgers` converts one or more Cairn research exports into a bundle for `research/ledgers`. Pass multiple exports to merge learners into a cohort. Prediction is available. Policy comparison requires propensities that Cairn does not log yet.
