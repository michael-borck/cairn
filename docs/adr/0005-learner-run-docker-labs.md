# 0005. Learner-run Docker labs for v1

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

Docker labs are the first content pack and a useful differentiator. Executing containers from the app adds sandboxing, platform support, security review, and significant scope.

## Decision

For v1, the learner runs commands in their own terminal. The app provides setup, tasks, hints, checks, and cleanup. The learner confirms results or pastes output. The app does not execute containers.

## Consequences

The pilot can ship without building and securing a container runner. Labs remain useful and hands-on.

Some learners will want in-app execution. That becomes a separate trust tier and a later runner with rootless containers, no privileged mode, no host mounts, no Docker socket, resource limits, pinned image digests, and explicit consent.
