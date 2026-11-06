# Cairn desktop

Tauri v2 shell with React, Vite, and TypeScript.

```bash
npm install
npm run tauri dev
```

From the repo root:

```bash
npm run tauri --workspace @cairn/desktop -- dev
npm run tauri --workspace @cairn/desktop -- build --debug
```

The Tauri script puts `CARGO_TARGET_DIR` under the user cache by default. This
repo lives on an exFAT volume, and macOS `._*` files inside a local `target/`
directory break Tauri's permission build. Override `CARGO_TARGET_DIR` if you
want a different location.

The shell has a `health` command that the UI calls to prove the Rust bridge is
connected.

Built:

- Built-in Docker pack and `.json` pack import.
- Session view for explain, worked example, MCQ, short answer, teach-back,
  reflection, and learner-run labs.
- Mastery map and "why this?" decision panel.
- Easier, harder, more help, and less help overrides.
- Learner state and decisions in local storage.

Not built yet:

- Directory pack import.
- SQLite storage adapter.
- AI controls and AI-backed hints.
- Pack authoring and export.
- Session history and review calendar.

Keep Rust limited to shell commands, storage, keychain access, and packaging.
The engine stays in TypeScript.
