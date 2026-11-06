# 0003. Tauri v2 desktop shell

- Status: Accepted
- Date: 2026-11-06
- Supersedes: none

## Context

Cairn needs a cross-platform desktop app with local storage, file import, and small downloads. The UI can be a web app. Electron is familiar, but Tauri produces smaller binaries.

## Decision

Use Tauri v2 with React, Vite, and TypeScript. Keep Rust limited to shell commands, SQLite, keychain access, and packaging. Keep the engine in TypeScript.

## Consequences

Smaller binaries and lower memory use than Electron. The web UI remains shell-agnostic and can run in a browser later.

Tauri adds a Rust toolchain and webview differences across macOS, Windows, and Linux. API keys must use the OS keychain, not localStorage. Packaging and signing need platform-specific work.
