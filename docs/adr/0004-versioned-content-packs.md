# 0004. Versioned content packs

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

Courses, skills, items, hints, and labs need a portable format so users can import their own material and share packs. Learner progress must survive pack updates.

## Decision

Use a versioned `.learnpack` zip with a JSON manifest, curriculum, items, rubrics, misconceptions, labs, and policy. Packs use semantic versioning. Skill and item IDs are stable and never reused. Deprecated skills point to a replacement. The catalog stores the artifact hash.

## Consequences

Content is portable and can be validated in CI. Updates can migrate learner state by stable skill ID.

The schema becomes a compatibility commitment. Pack authors must respect ID stability. Large packs need artifact hosting and hashing later.
