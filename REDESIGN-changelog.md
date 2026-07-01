# Bosque redesign — technical-fix pass

**Branch:** `redesign/taste-pass-2026-07` · **Date:** 2026-07-01 · **Author:** Tim (web dev)
Applied via `redesign-skill` + `taste-skill`. Safe, non-brand, reversible. Not merged, not live.

## Applied (no brand decisions involved)

| # | Fix | Files | Skill rule |
|---|-----|-------|-----------|
| 1 | Removed render-blocking `@import` of Google Fonts from CSS | `css/bosque.css` | Font-load perf |
| 2 | Added `preconnect` + font `<link>` to the 5 pages that relied only on the CSS `@import` | contacto, faq, legal, sobre, wellness | Consistency / perf |
| 3 | Added a favicon (SVG, reusing the **existing** inline leaf logo + existing brand tokens — no new identity) | new `favicon.svg` + all 8 live pages | "Missing favicon" |
| 4 | Global keyboard-focus ring for all interactive elements (was `.btn`-only) | `css/bosque.css` | a11y focus states |
| 5 | `text-wrap: balance` on headings, `text-wrap: pretty` on body — kills orphan words | `css/bosque.css` | Typography / orphans |
| 6 | Removed emoji from the asset-matrix headers (🧒💼🧘 → text; colour classes already carry meaning) | `index.html` | Emoji policy |
| 7 | Cut homepage eyebrows 8 → 3 (kept hero + "A solução Bosque" + "Três portas, um refúgio") | `index.html` | Eyebrow restraint (max 1 / 3 sections) |

## Deliberately NOT touched (needs sign-off — see `REDESIGN-brand-proposal-for-Sky.md`)

- **Display font (Fraunces)** and **palette (beige+brass)** — brand decisions → Sky.
- **38 em-dashes** in body copy — editorial → venture writer.
- **Stock Unsplash imagery** — needs real/branded photos → Sky.

## Housekeeping note

4 files don't use the shared CSS and look like old standalone prototypes:
`bosque.html`, `bosque2.html`, `bosque-clean.html`, `gemini2.html`.
Left untouched. Recommend deleting or moving to an `_archive/` folder once confirmed dead — Fernando to confirm.

## Preview
Open `index.html` in a browser (static site, no build). Or from the Website folder:
`python3 -m http.server 8000` → visit `http://localhost:8000`.
