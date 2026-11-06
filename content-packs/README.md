# Content packs

Packs are versioned content bundles. See [the pack schema](../docs/spec/pack-schema-v0.1.md).

`example/pack.json` is a minimal fixture for CLI smoke tests, not a real course.

Real packs:

- `docker-fundamentals`: containers, images, ports, volumes, networks, Dockerfiles, Compose, and troubleshooting.
- `git-github-fundamentals`: commits, status, branches, merges, conflicts, remotes, pull requests, ignores, and recovery.

Rules:

- Every pack has a licence, source, and changelog.
- Do not include copyrighted material you cannot redistribute.
- Do not include free-form system prompts.
- Labs are learner-run in v1.
- Media stays local or uses an allowlisted host.
- Packs must pass the validator.
