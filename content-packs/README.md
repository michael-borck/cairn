# Content packs

Packs are versioned content bundles. See [the pack schema](../docs/spec/pack-schema-v0.1.md).

`example/pack.json` is a minimal fixture for CLI smoke tests, not a real course.

Real packs:

- `command-line-fundamentals`: navigating the filesystem, reading and searching text, pipes, file management, find, permissions, and safety.
- `docker-fundamentals`: containers, images, ports, volumes, networks, Dockerfiles, Compose, and troubleshooting.
- `git-github-fundamentals`: commits, status, branches, merges, conflicts, remotes, pull requests, ignores, and recovery.
- `http-apis-fundamentals`: requests and responses, URLs, methods, status codes, headers, JSON, auth, REST, retries, and curl.
- `learning-how-to-learn`: retrieval practice, spaced repetition, interleaving, desirable difficulty, and study habits based on cognitive science.
- `local-ai-literacy`: tokens, context, generation, model sizes, running Ollama locally, prompting, and verification habits.
- `python-fundamentals`: values, control flow, functions, data structures, files, exceptions, and test basics.
- `sql-fundamentals`: the relational model, queries, joins and grain, aggregation, CTEs, safe modification, and indexes. Distilled from Model Data, Verify AI.

Rules:

- Every pack has a licence, source, and changelog.
- Do not include copyrighted material you cannot redistribute.
- Do not include free-form system prompts.
- Labs are learner-run in v1.
- Media stays local or uses an allowlisted host.
- Packs must pass the validator.
