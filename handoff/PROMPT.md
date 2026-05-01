# Renewal Overview — Claude Code Prompt

Paste this prompt into Claude Code. Attach the entire `handoff/` folder.

---

## The task

Generate a single self-contained HTML file: a polished renewal proposal for a CSM to share with a customer (live walkthrough or PDF export).

The output **must visually match the reference** in `handoff/reference/Renewal Overview.html` exactly — same typography, spacing, palette, and section structure. The only things that change between runs are the customer-specific values (names, numbers, package contents, dates).

## How to do it

1. **Read `handoff/SPEC.md` end-to-end first.** It defines the hard rules — typography, palette, section order, what not to add.
2. **Read `handoff/reference/Renewal Overview.html`, `renewal.jsx`, and `tweaks-panel.jsx`** to understand the exact markup and styles. Treat these as the canonical implementation.
3. **Read `handoff/input.example.json`** to understand the input shape and how it maps to the rendered doc.
4. **Take input data** (matching `handoff/input.schema.json`) and produce **one HTML file** named `Renewal Overview - {customer.name}.html`.
5. **Inline everything.** The reference splits CSS into the HTML and JSX into two `.jsx` files; the final output must be a single HTML file with all CSS in `<style>` and all JSX in `<script type="text/babel">` blocks. The Tweaks panel code from `tweaks-panel.jsx` and the renewal component from `renewal.jsx` both go inline.
6. **Keep the `EDITMODE-BEGIN/END` JSON block** with default tweak values. The block must be valid JSON.
7. **Do not deviate** from the rules in SPEC.md — no extra colors, no emoji, no extra sections, no overpaying language, no tier/shop ID in the meta row.

## Inputs

The user will provide either:
- A JSON object matching `handoff/input.schema.json`, OR
- A raw scale-report HTML/markdown that you must parse into that schema first.

If parsing a raw report:
- Pull the customer name, current MRR/ARR, UGC limit, 6-month average usage, utilization %, and seats from the "Current State" block.
- The recommended package is whichever tier the optimal-plan calculation flags.
- Use the **published pricing-page feature list** (already encoded in `input.example.json` for Growth) to populate `packageFeatures`. If the recommended tier is Startup or Enterprise, use that tier's features instead — the canonical lists for all three tiers are in SPEC.md and `input.example.json`.
- Compute Annual and 2-Year option numbers using the discount rates the source data implies (typically 10% / 20%). Show your work.

## Output

A single file at the path the user specifies (or `Renewal Overview - {customer.name}.html` if not specified). Open it in a browser to verify it renders. The file should:

- Render identically to the reference in look-and-feel
- Print cleanly to a 1–2 page US Letter PDF
- Have a working Tweaks toolbar (tone, density, highlight, show-stats, print button)

## Validation checklist before finishing

- [ ] No tier or shop ID anywhere
- [ ] No UGC usage averages, no current-month UGC, no utilization %
- [ ] No "overpaying" framing
- [ ] Forest green is used **only** for savings — never for any other purpose
- [ ] Every dollar amount uses tabular-nums and a `.currency` `$` glyph
- [ ] Strikethrough list price + discounted price together on every line item
- [ ] Exactly four sections: 01 Where you are today / 02 Our recommendation / 03 What's included / 04 Two ways to renew
- [ ] Featured option has 1.5px ink border + gradient fill + dark "Recommended" tag; the other has thin rule + muted "Option A/B" tag
- [ ] Print stylesheet hides the Tweaks panel
- [ ] EDITMODE-BEGIN/END block is valid JSON
- [ ] Output is a single HTML file with no external dependencies beyond the pinned React/Babel CDN scripts and Google Fonts
