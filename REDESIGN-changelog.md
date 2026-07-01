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

## Reconciled against the Brand Book (after reading the spec + positioning docs)

Earlier draft of this pass flagged the palette and font as "AI defaults." The Brand
Book / Website Spec show both are **deliberate, documented decisions** — so those
flags were retracted:

- **Palette** — LOCKED per Spec §2.2 (pinhal: pine + linen + golden-hour amber). No change.
- **Display font (Fraunces)** — a deliberate editorial choice AND already Fernando's
  logged open decision (Spec §10 #5: confirm Fraunces vs Schibsted-as-display). → Sky/Fernando.
- **Em-dashes** — in-voice for the "editorial estate" brand voice. Copy left untouched;
  writer handoff WITHDRAWN.
- **Real photography** — the one genuinely open visual item (Spec §2.4/§8/§10 #2). → Sky.

## Housekeeping

`bosque2.html`, `gemini2.html` → moved to `_archive/` (not referenced anywhere).
`bosque.html`, `bosque-clean.html` were briefly archived then **restored** — Spec §8
names them as component-source builds, not dead files.

## Preview
Open `index.html` in a browser (static site, no build). Or from the Website folder:
`python3 -m http.server 8000` → visit `http://localhost:8000`.
