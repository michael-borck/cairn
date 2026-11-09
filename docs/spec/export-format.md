# Research export format v0.1

Cairn can export a learner bundle for offline analysis with the Ledgers research harness.

## Cairn export

The desktop app writes one JSON file containing:

```ts
interface CairnExport {
  schemaVersion: "0.1";
  exportedAt: string;
  app: { name: "Cairn"; version: string; engineVersion: string };
  pack: ContentPack;
  learner: LearnerState;
  events: EvidenceEvent[];
  decisions: Decision[];
  model: typeof ENGINE_MODEL;
  policy: ContentPack["policy"];
}
```

The export includes the full pack, not only the pack ID, so the bundle is self-contained and reproducible.

The model block records the BKT defaults, half-life constants, evidence half-life, and session gap. The policy block is the pack policy used by the engine.

Every attempt should carry a `decisionId` when it came from a selected decision. Manual activities also create a decision record.

## Ledgers bundle conversion

```bash
npx tsx apps/cli/src/index.ts ledgers cairn-export.json --out cairn-export.ledgers.json
# merge several learner exports into one cohort bundle
npx tsx apps/cli/src/index.ts ledgers learner-1.json learner-2.json learner-3.json --out cohort.ledgers.json
```

The converter maps:

- Cairn skills to `{ id, prereqs }`.
- Cairn item difficulty 1 to 5 to Ledgers author difficulty `(difficulty - 3) / 2`, on roughly -1 to 1.
- Cairn item types to Ledgers item kinds. Explain and worked example map to `worked`; the rest map to `practice`. Tags can select `transfer`, `contrast`, or `probe`.
- Cairn skill tags to Ledgers noisy-AND weights. The first skill gets weight 1; secondary skills get 0.5.
- Cairn events to Ledgers attempts. `correct` falls back to `score >= 0.6`. Confidence is mapped from guess, unsure, and sure to 0.33, 0.65, and 0.95.
- `durationMs` to `latencyMs`.
- `decisionId` is carried through.

## Important limitation

Cairn decisions are exported for history, but they are not converted into Ledgers decisions. Ledgers policy comparison needs exact action probabilities and propensities. Cairn does not log those yet.

That means:

- Next-response prediction is available today.
- Policy differences and value estimates are not available until Cairn logs propensities.

Do not force the policy report. Use the prediction report first.
