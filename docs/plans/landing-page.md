# Landing page plan

- Domain: `cairn.borck.education`
- Status: Live at https://cairn.borck.education
- Build: static page, separate from the app

## Verdict

Yes, build a minimal landing page now. You have a working app, two packs, a clear position, and a privacy story. A one-page site will explain the project better than a README on GitHub.

Do not build a full marketing site. One page and a trust page are enough.

## Domain check

`cairn.borck.education` was added on 2026-11-09. The CNAME currently points at `michael-borck.github.io`. The site itself is not built yet.

The landing page is drafted under `site/`. A GitHub Actions workflow deploys it to Pages. Enable **Settings → Pages → Source: GitHub Actions** and push a change under `site/`.

The page follows the structure below.

## Page structure

1. **Hero**
   - Cairn
   - "A personal tutor that runs on your machine."
   - "Bring your own notes, textbooks, and labs. See why the path changes. Keep your data."
   - Buttons: Download for macOS, View on GitHub.

2. **The problem**
   - Most adaptive tutors are cloud-first, account-based, and opaque.
   - They own the path and the data.
   - Cairn does the opposite.

3. **Three pillars**
   - Private by default: local data, no account, AI off is a real mode.
   - Adaptive and explainable: every decision has a reason and an override.
   - Own your content: import notes and textbooks, author packs, export everything.

4. **A short demo**
   - Screenshot or short GIF of a session and the "why this?" panel.
   - One concrete example: a wrong answer changes the next activity and the help level.

5. **Packs**
   - Docker Fundamentals
   - Git & GitHub Fundamentals
   - Community library: coming after the pilot.

6. **Trust**
   - What stays local.
   - What goes to Ollama or a cloud AI provider.
   - What is never collected.
   - Export and delete.
   - Link to the privacy and data-flow page.

7. **Pilot**
   - "Try the pilot" or "Join the pilot."
   - Short form or email link.
   - Explain what participation involves and what is measured.

8. **Footer**
   - GitHub
   - Docs
   - Licence
   - Acknowledgments

## Trust page

A separate short page with:

- a data-flow diagram
- local-only mode
- AI off, assist, full
- no account, no telemetry by default
- export and delete
- open source and reproducible builds
- contact and security reporting

## Technical shape

- Static site in `site/` or a separate `cairn-site` repo.
- GitHub Pages or Cloudflare Pages.
- No analytics by default.
- One screenshot or short demo video.
- Reuse the Cairn palette and typography.

## What not to do

- No fake testimonials.
- No "AI will replace teachers" language.
- No "revolutionary adaptive algorithm" claim.
- No dark patterns.
- No account wall.
