# 0009. No free-form prompts in content packs

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

Community packs are untrusted input. A free-form system prompt can steer the learner's AI provider, leak context, or produce unsafe output. A game store can tolerate inert text. A learning app with AI and labs cannot.

## Decision

Content packs do not contain free-form system prompts. The engine owns prompt templates. Packs provide typed content, rubrics, hints, misconception mappings, and item metadata. AI output must match a typed schema. Pack content gets no tool access. AI mode off must work with static content.

## Consequences

Pack authors lose some flexibility. The app gains a much smaller prompt-injection surface and a predictable AI boundary.

Some pedagogical styles will need new engine templates rather than custom prompts. Those templates must be reviewed and versioned.
