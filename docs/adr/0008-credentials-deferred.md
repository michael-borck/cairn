# 0008. Credentials deferred, local completion record first

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

Credentials need identity, assessment integrity, verification, and revocation. Those require a trusted central service. The pilot does not need them.

## Decision

For v1, issue a local completion record with pack ID, learner name, date, score, and engine version. Export it as JSON or PDF. Call it a record, not a credential.

Later, add signed badges and a static verification page. For high-stakes use, add an issuer service with accounts, assessment integrity, revocation, and proctoring.

## Consequences

The pilot avoids identity and anti-cheat work. Learners can keep proof of completion locally.

A local record is easy to forge and is not a credential. High-stakes credentials remain a separate product with legal and security obligations.
