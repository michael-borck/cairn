# Cairn landing site

Static landing page and trust page for `cairn.borck.education`.

## Preview

```bash
python3 -m http.server -d site 8000
# http://localhost:8000
```

## Deploy

The site is plain HTML and CSS. It can be hosted on GitHub Pages or Cloudflare Pages.

For GitHub Pages with Actions:

1. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
2. Push a change under `site/`.
3. The `Deploy site` workflow publishes `site/`.

The `site/CNAME` file points the published site at `cairn.borck.education`.

## Content rules

- No fake testimonials.
- No “revolutionary algorithm” claims.
- No account wall.
- No analytics by default.
- Keep the trust page accurate.
