# 0007. Authoring GUI after engine core

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

A good authoring GUI is a substantial product. The 12-week v1 needs a working engine, app, and one content pack. Content can be authored in YAML and validated with a CLI.

## Decision

Use CLI and YAML authoring for v1. Build a local content studio in v1.5. The studio covers skills, items, hints, misconceptions, rubrics, preview, validation, and pack export. It is local-first and does not require a server.

## Consequences

v1 stays focused on the adaptive loop. Authors need to be comfortable with text files at first.

The studio becomes a separate workstream. The pack format must be stable before the studio is built, or the editor will chase schema changes.
