# Renewal Overview — Generation Spec

You are generating a **single-file HTML renewal proposal** for a CSM to share with a customer (live walkthrough or PDF). Match the reference exactly — typography, spacing, palette, and structure are intentional.

## What to produce

A single self-contained HTML file: **`Renewal Overview - {CUSTOMER_NAME}.html`**

- All CSS inline in `<style>` (no external stylesheets except Google Fonts)
- All React/JSX inline using `<script type="text/babel">` blocks (no external `.jsx` files)
- Pinned React 18.3.1, ReactDOM 18.3.1, Babel standalone 7.29.0 with the integrity hashes from the reference
- Print-ready (`@page { size: letter }`)

The reference implementation is in `reference/Renewal Overview.html` + `reference/renewal.jsx` + `reference/tweaks-panel.jsx`. **Inline `tweaks-panel.jsx` and `renewal.jsx` into the final HTML file** — do not ship them as separate files. The skill output must be one file.

## Inputs

Inputs come from a JSON object matching `input.schema.json`. Every field is required unless marked optional. Don't invent values; if a field is missing, leave it blank or omit the relevant block.

## Hard rules — do not violate

1. **Typography is fixed.** Headlines + big numbers use **Instrument Serif**. Body uses **Inter**. Don't substitute.
2. **Palette is fixed.** Paper `#FAF7F1`, ink `#1A1714`, accent (savings only) `#2F5D3A`, accent-soft `#E8EFE3`, rules `#D9D2C2` / `#E8E2D2`. Don't add colors.
3. **Numbers use `font-variant-numeric: tabular-nums`** wherever they appear — keeps columns aligned.
4. **Currency = `$` glyph at smaller size, raised baseline.** See `.hero-amount .currency`. Don't render `$` at full size next to the numerals.
5. **Strikethrough list price + discounted price** for line items — never show the discounted price alone.
6. **One accent color for savings.** Forest green. Don't use red for "increase" or any other status color in this doc.
7. **No emoji, no icons** other than the inline SVG checkmark and the brand glyph.
8. **No tier or shop ID** in the meta row. Only: Customer, Prepared by, Date.
9. **No "overpaying" framing, no usage stats, no utilization percentages.** Don't render UGC monthly averages, current-month UGC, or utilization %. The current-state summary describes the plan neutrally.
10. **Section count is fixed at four:** 01 Where you are today, 02 Our recommendation, 03 What's included, 04 Two ways to renew.
11. **Two options exactly** — Annual (1-yr) and Biennial (2-yr). If only one commitment term applies, still render both cards; pass the unavailable one as `null` and the renderer hides it.
12. **The featured option gets a 1.5px ink border + gradient paper fill + dark "Recommended"/"Best value" tag.** The other gets a thin rule + muted tag.

## Sections — content rules

### Header (brand bar + title)
- Brand: black-circle glyph + "Archive" wordmark, left. Right side: `For {CUSTOMER_NAME} · {DATE}`.
- Eyebrow: tone-dependent (see TONE_COPY in `renewal.jsx`).
- Title: 64px Instrument Serif, two lines, second line italic. Tone-dependent copy.
- Subtitle: ≤2 sentences, ≤160 chars. Tone-dependent.
- Meta row: Customer, Prepared by, Date.

### 01 — Where you are today
- Left column: a single sentence summary in 22px Instrument Serif. Highlight 1–2 key terms with `<strong>` (renders with olive marker underlay). **Do not reference UGC usage volumes or utilization percentages** — focus on plan fit / right-sizing language.
- Right column: 2-column stat grid. Required keys: Current plan, Current MRR, Current ARR, UGC limit, Active seats, Workspaces. **Do not render UGC usage averages or utilization percent.** Render only what's provided.

### 02 — Our recommendation
- Single horizontal strip in `paper-2` background.
- Left: eyebrow ("Recommended tier") + one sentence in 22px Instrument Serif. Highlight the recommended package name with `<strong>`.
- Right: pill with the tier name (e.g. "Growth Tier").

### 03 — What's included
- Header row: package name (32px serif) + tagline (italic serif) on the left; UGC Limit + Credits allowances on the right.
- Three columns below:
  - **Features** — bullets with checkmarks. Each item is a string, OR `{name, note}` to render `Name (note)` with the note in italic gray.
  - **Credits-based** — same shape as Features.
  - **Available add-ons** — plain bulleted list, no checkmarks.
- Use the pricing data from `input.packageFeatures` verbatim. Don't paraphrase feature names.

### 04 — Two ways to renew
- Two cards side by side (`grid-template-columns: 1fr 1fr`).
- Each card:
  1. Tag pill at top-left (overlapping border): "Recommended" (featured, dark) or "Option A/B" (muted).
  2. Header row: option name (26px serif) + term ("1-Year Commitment").
  3. Hero monthly: `$X,XXX` at 68px serif + "per month" caption.
  4. Hero trio: Annual price · You save · Reduction. Savings cells use forest green. Numbers in 26px serif.
  5. Line items: Growth base plan (with strikethrough list price) + UGC packs (with strikethrough list price). Sub-line shows included UGC and "{N}% commitment discount".
  6. Savings callout: green-soft block with "Annual savings" label + amount.

### Footer
- Left: tone-dependent signoff in italic serif.
- Right: `Archive · Prepared {DATE} · Pricing valid 30 days`.

## Tweaks panel

Inline the `tweaks-panel.jsx` source. Expose:

- **Tone** — Polished sales / Neutral summary / Friendly advisory (`select`)
- **Highlight** — 1-yr / 2-yr (`radio`)
- **Show full current-state stats** (`toggle`)
- **Density** — Compact / Regular / Comfy (`radio`, sets `body[data-density]`)
- **Print / Save as PDF** button (calls `window.print()`)

Tweak values live in the `EDITMODE-BEGIN/END` JSON block — keep that block intact and parseable.

## Print

`@page { size: letter; margin: 0 }`. `@media print`: drop shadows, reset background to paper, hide `.twk-panel` and any `[data-noncommentable]`. The doc should fit on 1–2 letter pages at Regular density and 1 page at Compact.

## Tone variants (from `TONE_COPY` in `renewal.jsx`)

Three sets of copy: `polished`, `neutral`, `advisory`. Each defines: `eyebrow`, `title` (JSX with `<br/>` and `<em>`), `sub`, `summaryLead` (JSX, may include `<strong>` and `<em>`), `recEyebrow`, `recText` (JSX), `recPill`, `signoff`. Default tone: `polished`.

When the customer's usage profile differs from the demo (different util %, different recommended tier, etc.), regenerate the `summaryLead` and `recText` to match the new numbers, but keep the same shape and length.

## Numbers — formatting

- Currency: `$X,XXX` (no decimals, US-style commas, no space between `$` and number except via the `.currency` span).
- Percentages: integer, e.g. `25%`, `40%`.
- UGC counts: comma-thousands, e.g. `3,780`, `15,000`.
- Period suffix: `/mo`, `/yr`. The `<span class="unit">` muted style is for the unit only.

## Don't add

- Logos other than the Archive glyph + wordmark.
- Testimonials, case studies, "why us" copy.
- Multiple recommended packages — exactly one.
- Charts, graphs, sparklines, icons.
- Disclaimers beyond "Pricing valid 30 days".

## Files in this handoff

- `SPEC.md` — this file
- `input.schema.json` — JSON Schema for the input data
- `input.example.json` — the example data used in the reference render
- `reference/Renewal Overview.html` — reference markup + styles
- `reference/renewal.jsx` — reference React component
- `reference/tweaks-panel.jsx` — reference Tweaks shell

The output is **one HTML file**. Inline everything from the reference into it.
