# 0006. Static PR-curated community library

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

A community content library needs discovery, review, and distribution. A full marketplace with accounts, payments, and moderation at scale is too large for v1.

## Decision

Use a static catalog and pack artifacts served from GitHub Pages or Cloudflare Pages. Submissions are pull requests. CI validates schema, hashes, licences, media, and safety rules. A maintainer reviews content before merge. The app downloads a pack, verifies it, and installs it locally. The local library is the source of truth.

Launch with first-party packs only. Open PR submissions after the pack format is stable. Add a submission portal only if non-technical creators need it.

## Consequences

No central learner database, no accounts, and low hosting cost. Content updates do not require an app release.

PR review does not scale to a large marketplace. Payments and creator payouts are out of scope. Accuracy review and lab safety remain human work.
