# VOID 28

Static marketing site. No build step, no dependencies — every file here is what
gets served.

## Structure

```
.
├── index.html            landing page
├── contact.html          contact form (Netlify Forms)
├── thanks.html           post-submit page, noindex
├── assets/
│   ├── css/
│   │   ├── tokens.css        colour / type tokens, dark + light themes
│   │   ├── base.css          reset, canvas layers, typography, scaffolding
│   │   ├── components.css    nav, controls, buttons, rows, cards, footer
│   │   ├── landing.css       hero and landing-only sections
│   │   └── contact.css       contact page and form
│   ├── js/
│   │   ├── i18n.js           every string, five languages (en/ru/es/de/zh)
│   │   ├── background.js     particle field + black hole (dark) / quasar (light)
│   │   ├── site.js           language, theme, calculator, reveals
│   │   └── contact.js        form validation feedback
│   └── img/                  logo, favicons, open-graph card
├── site.webmanifest
├── robots.txt
├── sitemap.xml
└── netlify.toml          headers and cache policy
```

## Running it locally

```bash
python3 -m http.server 8899
```

Then open http://127.0.0.1:8899 — paths are absolute (`/assets/...`), so opening
`index.html` straight off the disk will not load the CSS.

## Before going live

Replace the placeholder domain `void28.ai` with the real one in:

- `index.html`, `contact.html` — `<link rel="canonical">`, `og:url`, `og:image`
- `robots.txt` — `Sitemap:`
- `sitemap.xml` — both `<loc>` entries
- the JSON-LD block at the bottom of `index.html`'s `<head>`

And the placeholder address `hello@void28.ai` in `index.html` and `contact.html`.

## The form

`contact.html` posts to Netlify Forms: `data-netlify="true"`, a hidden
`form-name` field, and a honeypot named `bot-field`. Netlify picks the form up
from the static HTML at deploy time — nothing to configure in code. Submissions
land in **Netlify → Forms → contact**.

## Translations

Text lives in `assets/js/i18n.js`, keyed by the `data-i` (text), `data-ih`
(HTML) and `data-ip` (placeholder) attributes in the markup. To change a
sentence, edit the key — not the HTML.
