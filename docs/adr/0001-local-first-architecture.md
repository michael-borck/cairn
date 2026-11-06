# 0001. Local-first architecture with optional cloud services

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

Learners want privacy, offline access, and control over their notes and progress. The product also needs a community content catalog and may later need credentials, sync, or cohort features.

## Decision

The learning core is local-first. The app stores learner data on the device and works without an account or network connection. Cloud services are optional and added only where they are unavoidable, such as a static content catalog, credentials, or teacher sharing.

Three rings:

1. Local core: engine, content packs, authoring, local analytics, AI off or assist.
2. Community catalog: static JSON and pack artifacts, PR curated, installed locally.
3. Institutional services: credentials, sync, dashboards, LMS. Separate and optional.

## Consequences

Privacy and data minimisation become credible product claims. The app works offline. We avoid a central learner database in v1.

Multi-device sync, backup, support, credentials, and cohort analytics become later work. Paid content is harder to protect. Local-first is not automatically private or secure, so data flows must stay explicit.
