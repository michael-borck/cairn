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
connected. The engine smoke test runs the TypeScript engine inside the webview
using a tiny in-memory pack.

Not built yet:

- Pack import and local library.
- Session view and mastery map.
- SQLite storage adapter.
- Difficulty, help, AI, and path controls.
- Pack authoring and export.

Keep Rust limited to shell commands, storage, keychain access, and packaging.
The engine stays in TypeScript.
