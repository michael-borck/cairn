# 0002. TypeScript engine core, Python for offline fitting

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

The team is comfortable with Python because of ML and AI work, but the UI is web technology. The adaptive engine is mostly graph traversal, BKT arithmetic, rules, and scheduling. It does not need Python at runtime.

## Decision

Implement the reference engine in TypeScript as a pure package with no I/O. Use Python for offline analysis, BKT parameter fitting, experiments, and future model training. Expose a language-agnostic JSON-RPC or CLI surface so a Python client can wrap the same engine later.

## Consequences

One runtime for the app, CLI, and tests. The engine is easy to embed in Tauri, a browser, or Node. Python remains available for research without creating a second production implementation.

A Python library will be a client, not a port. If a Python runtime is ever required, it will be a sidecar with an explicit interface.
