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

- Built-in Docker pack, `.json` pack import, and folder import through the
  native dialog.
- Session view for explain, worked example, MCQ, short answer, teach-back,
  reflection, and learner-run labs.
- Mastery map, due-review panel, 14-day review calendar, recent activity, and
  "why this?" decision panel.
- Easier, harder, more help, and less help overrides.
- SQLite storage through `tauri-plugin-sql`, with local-storage fallback in the
  browser.
- AI modes off, assist, and full, backed by a local Ollama instance. AI is off
  by default, hints are optional, and AI output is never recorded as learner
  evidence. Pull a model first, for example `ollama pull llama3.1:8b`, then set
  the model name in the AI panel.
- Pack authoring v0.2: form tabs for metadata, modules, skills, items, and
  policy, plus a raw JSON tab. Validate with the real schema, save to the local
  library, import a draft, and export through the native save dialog.
- Material import: Markdown, HTML, DOCX, EPUB, and PDF become a draft pack in
  the authoring editor. The importer creates explain items and a reflection.
- AI practice generator: choose a skill, generate three MCQ or short-answer
  candidates from the imported material, review them, then insert them into the
  draft. Requires local Ollama and human review.
- Advanced fields such as hints, media, labs, and rubrics remain in the JSON
  tab.

Not built yet:

- Better PDF heading and section detection.
- More AI providers beyond local Ollama.
- Badges and optional challenge modes.
- Mobile targets.

Keep Rust limited to shell commands, storage, keychain access, and packaging.
The engine stays in TypeScript.
