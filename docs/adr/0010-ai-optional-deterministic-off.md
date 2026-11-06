# 0010. AI optional, deterministic off mode

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

AI can generate hints, feedback, variants, and grade free text. It can also add cost, latency, privacy risk, and unpredictable behaviour. Some learners cannot or will not use cloud AI.

## Decision

AI is optional and user-selectable: off, assist, or full. Off mode uses static content and deterministic scoring. Assist generates hints and feedback grounded in the pack. Full adds variants, explanations, and free-text grading. Every AI output is labelled. AI-generated content is ephemeral unless a human approves it into a pack.

## Consequences

The app works offline and remains testable. Privacy claims stay credible.

AI features need provider adapters, cost caps, caching, output validation, and fallback paths. Some learners will still choose cloud AI, so data flow must be disclosed clearly.
