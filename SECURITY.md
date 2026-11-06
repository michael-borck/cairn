# Security

Cairn handles learner data, local content packs, and optional AI calls. Please report security issues privately to the maintainer rather than opening a public issue.

## Scope

- Local data storage and export.
- Content pack validation and import.
- Prompt injection through content packs.
- Lab instructions and any future code execution.
- API key handling and provider calls.
- Community catalog downloads and pack hashes.

## Rules

- No secrets, API keys, learner data, or private content in the repository.
- Media URLs are allowlisted.
- Packs cannot contain free-form system prompts.
- Pack content never gets tool access.
- App-executed labs are out of scope for v1.
- A future lab runner must use rootless containers, no privileged mode, no host mounts, no Docker socket, resource limits, pinned image digests, and explicit consent.

## Reporting

Contact the maintainer directly. Include a minimal reproduction and the affected version or commit. Do not include real learner data.
