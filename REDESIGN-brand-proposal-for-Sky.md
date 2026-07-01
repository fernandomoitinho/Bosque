# Bosque — Brand-Direction Options (for Sky's sign-off)

**From:** Tim (web dev) · **To:** Sky (brand) · **Date:** 2026-07-01
**Branch:** `redesign/taste-pass-2026-07` · **Status:** awaiting brand decision

I ran the `redesign-skill` / `taste-skill` rubric against the live site. The **technical fixes are already applied on the branch** (see `REDESIGN-changelog.md`). The two items below are **brand/visual-identity decisions — your call, not mine to make.** I've framed them as options so you can pick a direction; I implement once you sign off.

---

## Why we're changing anything

The current identity scores as textbook "AI-generated premium brief" on two of the rubric's most-cited tells:

1. **Display font = `Fraunces`** — one of the two serifs the rubric names as an explicit LLM default ("the single most-tested AI tell"). Serif-as-default for a creative/lifestyle brief is the giveaway.
2. **Palette = cream `#F3EFE7` + copper/clay/terra (`#C97B3C`, `#B5713C`, `#C98C6B`) + espresso-green near-black** — this is *verbatim* the "premium-consumer beige/brass/espresso" family the rubric flags as "the second-most-recurring AI-tell… the brand becomes invisible."

Neither is *broken* — but together they make Bosque look like every other wellness/artisan site. The name literally means **woods**; we can lean into that instead of defaulting to spa-beige.

---

## Decision 1 — Display typeface (move off Fraunces)

Pick one direction:

- **A · Distinctive serif (editorial).** Keeps the warm/refined feel but with a serif that has a point of view. Options: *PP Editorial New*, *Reckless Neue*, *GT Sectra*. Body stays a clean sans (Schibsted Grotesk / Inter are fine).
- **B · Sans display (modern nature-brand).** Drops serif entirely for a confident sans display — reads less "spa", more "designed retreat". Options: *PP Neue Montreal*, *Cabinet Grotesk Display*, *GT Walsheim*.

My lean: **B** suits "Bosque" better and is furthest from the AI default — but this is your aesthetic call.

## Decision 2 — Colour palette (move off beige + brass)

Pick one family (all keep a nature-forward, premium feel; all are in the rubric's "rotate to these" pool):

- **1 · Forest** — deep green + bone + a single amber accent (Filson / Patagonia-premium energy). Closest to the "Bosque" name.
- **2 · Olive + Brick + Paper** — muted olive with a brick-red accent; warm but not beige.
- **3 · Black & Tan** — true off-black + warm tan, sharp contrast, zero cream.

My lean: **Forest (1)** — on-name, distinctive, and reuses the existing pine-green token as an anchor so the change isn't jarring.

---

## What happens after you decide

Reply with e.g. *"B + Forest"* and I'll:
1. Swap the `--display` font token + self-host the chosen faces.
2. Re-pigment the CSS tokens (`--linen-*`, `--amber-500`, the three sub-palettes) to the chosen family.
3. Re-run the taste pre-flight (contrast, one-accent-per-page lock) and push to the branch for review.

**Nothing goes live** until Fernando gives the explicit go-ahead.

## Still needs a person (not me)

- **Hero + section imagery** is generic Unsplash stock — the biggest "is this a real business" signal. Needs real photos of the actual Belverde space, or generated brand imagery. → **Sky** to art-direct / source.
- **Copy: 38 em-dashes** used as flourish across the body (an AI tell the rubric bans). Light punctuation cleanup — → the venture's **writer**, not me, so voice stays intact. I left the copy untouched.
