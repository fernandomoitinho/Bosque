# Bosque — Photography Art-Direction & Shot List

**From:** Tim (web dev), via `imagegen-frontend-web` skill · **For:** Sky + the photographer · **Date:** 2026-07-01
**Grounded in:** Spec §2.4 (Photography & art direction), §2.1 (the "same clearing, three lights" signature).

## Read this first — two hard rules

1. **The live site needs REAL photos of the actual cave + jardim.** AI-generated images may be
   used as **reference comps** (to brief the shoot) or as **temporary placeholders clearly marked
   as such** — but must NOT ship on the live customer-facing site pretending to be the real venue.
   This is a booking site for a real property; misrepresenting the space is a trust (and legal) problem.
2. **The generation prompts below produce reference comps, not the final assets.** Render them with
   an image tool (Sky has `gemini-image`) to align on look, then shoot the real thing to match.

---

## The one brand image world (continuity — applies to EVERY frame)

- **Place:** Belverde pinhal — Atlantic pine, sandy soil, golden light filtering through canopy.
- **Grade (umbrella):** warm, slightly desaturated, natural light. Never stock-corporate, never HDR-punchy.
- **Feel:** editorial estate — full-bleed, real human warmth, lived-in, médio-alto.
- **Material vocabulary:** raw wood, linen, stone, greenery, firelight, natural textiles.
- **People:** real and candid, never posed "diverse-stock" clichés. Often implied (a set table, a rolled mat) rather than face-front.
- **Consistency lock:** same location, same lens language (35–50mm feel), same warm grade across all frames so the whole site reads as one place.

---

## PRIORITY 1 — the signature: "the same clearing, three lights"

The hero cross-fade and the homepage's whole thesis depend on this: **the identical cave+jardim
vantage, shot at three times of day.** Same framing, same spot — only the light and the life change.
Fills `--img-well`, `--img-biz`, `--img-kids` (and the hero stage). Shoot all three from the same tripod position.

**Frame A — Manhã / Wellness** (fills `--img-well`) · AR 21:9 + 16:9 crops
> Prompt: *Wide editorial photograph of a private garden clearing in an Atlantic pine forest at dawn, soft mist, low golden light through the canopy, a single yoga mat and a folded linen blanket on the grass, calm and empty, warm slightly-desaturated grade, natural light, estate-quality, no people faces, cinematic full-bleed.*

**Frame B — Tarde-Noite / Business** (fills `--img-biz`) · AR 21:9 + 16:9
> Prompt: *Same garden clearing in a pine forest, late afternoon into blue hour, a lit firepit glowing warm, a few chairs and a laptop closed on a wood table, relaxed after-work atmosphere, copper-warm firelight against cool dusk, editorial grade, no faces, full-bleed.*

**Frame C — Fim de semana / Kids** (fills `--img-kids`) · AR 21:9 + 16:9
> Prompt: *Same garden clearing in a pine forest, golden weekend afternoon, a child's birthday set-up — bunting between trees, a cake table under a pergola, soft sunlight, joyful but tasteful (not plastic-primary), warm grade, candid, no identifiable faces, full-bleed.*

---

## PRIORITY 2 — the two core spaces

**Cave interior** (fills `--img-cave`) · AR 3:2 · homepage solution block, sobre gallery
> Prompt: *Interior of a climate-controlled 100 m² cellar-studio, warm minimal, polished concrete or wood floor, soft even light, a versatile empty space that could be a yoga studio or a meeting room, one plant, linen textures, warm neutral grade, architectural editorial, no people.*

**Garden wide** (fills `--img-garden`) · AR 3:2 · sobre hero, gallery
> Prompt: *A private 200 m² walled garden inside an Atlantic pine forest at golden hour, lawn, a pergola, mature pines, warm inviting light, estate feel, empty and serene, warm slightly-desaturated grade, full-bleed editorial.*

---

## PRIORITY 3 — segment heroes & differentiators (single-life, palette-nudged grade)

| Slot | Page | Shows | AR | Grade nudge | Comp prompt (abbrev.) |
|---|---|---|---|---|---|
| seg-hero Kids | kids.html | garden in party mode, safe & fenced | 16:9 | sunnier | *fenced forest garden, kids' party, golden sun, bunting, safe & private* |
| Kids diff | kids.html | the fenced/secure garden edge | 4:3 | sunnier | *low fence line at the forest garden edge, safe enclosed lawn, warm afternoon* |
| seg-hero Business | business.html | team offsite in the garden | 16:9 | cooler/copper | *small team around a wood table in a pine-forest garden, laptops, relaxed offsite, late-afternoon* |
| Business diff | business.html | pitfire at dusk, networking | 4:3 | copper | *glowing firepit in a forest garden at blue hour, chairs, warm networking mood, no faces* |
| seg-hero Wellness | wellness.html | serene garden, pinhal | 16:9 | soft/sandy | *serene empty forest garden at dawn, mist, a single mat, calm, soft sandy grade* |

---

## PRIORITY 4 — supporting

- **Owner portrait** (sobre.html avatar) · AR 1:1 · *a real, warm candid portrait of the owner-operator in the garden — this is the "carinho" anchor; must be the real person, not generated.*
- **Gallery extra — pitfire** (index gallery) · AR 4:3 · covered by Business diff prompt above.

---

## Technical delivery (Spec §8)

- Formats: **AVIF + WebP**, with a JPG fallback. Compressed. Lazy-load everything except the hero.
- Sizes per slot: hero ≥ 1800px wide (one heavy asset above the fold, optimise LCP); life cards ~800px; gallery ~600–800px; avatar ~200px.
- Deliver named to match tokens: `cave`, `garden`, `kids`, `biz`, `well` (+ `pitfire`), so Tim swaps the 5 `--img-*` URLs in `css/bosque.css` and the inline `url(...)` refs in one pass.
- `prefers-reduced-motion` falls back to the 3-up triptych — so Frames A/B/C must each also read well as a static still.

## Hand-back
Sky: render the Priority-1 comps first (that's the signature), align with Fernando on the look,
then this becomes the shoot brief. When real assets land, hand them to Tim → one swap commit on the branch.
