# Provenance

- Source: `/Users/michael/Desktop/dynamic/ledgers.zip`
- Source SHA-256: `99986c24991a5546182fd4fc508c4b51882195efbfecec54d33274fb7b827199`
- Imported: 2026-11-09
- Original package licence: `UNLICENSED`
- Licence in this repository: MIT, by decision of the repository owner
- Status: research prototype
- Production integration: none

## Verification at import

- `npm test`: 19 tests passed.
- `npm run simulate`: reproduced the supplied sample report.
- No runtime dependencies.

## What is trusted

The prediction model, the replay harness, the self-check, and the decision logging are worth studying and testing on real logs.

The prediction report is the first result to trust. It compares the candidate against a base rate, a plain BKT baseline, and ablations on held-out learners.

## What is not trusted yet

- The sample candidate policy has a negative delayed-sentinel estimate:

```text
Candidate SNIPS estimate: 0.587
Logged policy mean outcome: 0.598
Difference: -0.010
95% CI [-0.017, -0.005]
```

- The policy comparison mixes model and policy changes. The candidate uses fitted item parameters.
- The logging policy cannot be reconstructed from a parameter hash alone. Real-log replay needs the full logging model and policy, or a parameter registry keyed by the hash.
- The hint convention treats a hinted correct answer as not correct. That is a strong choice, not a neutral one.
- Blame and forgetting-blame are heuristic allocations, not proven exact posteriors.
- Multi-skill allocation barely moves next-response prediction. It needs a sentinel-on-secondary-skill test.
- `npm run harness` originally did not compile first. The imported copy fixes that.

## Running it

```bash
cd research/ledgers
npm install
npm test
npm run simulate
```

The package is private and is not part of the root npm workspace.

## Related records

- [ADR 0011](../../docs/adr/0011-incorporate-ledgers-research-prototype.md)
- [Adaptive model research log](../../docs/research/2026-11-09-adaptive-model-design.md)
- [Adaptive methods audit](../../docs/spec/adaptive-methods-audit.md)
