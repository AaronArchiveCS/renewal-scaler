# Renewal Overview — Claude Code Handoff

This folder is everything Claude Code needs to generate renewal-overview HTML documents that match the reference design exactly.

## Files

- **`PROMPT.md`** — Paste this into Claude Code. The starting prompt.
- **`SPEC.md`** — The hard rules: typography, palette, section structure, what not to add.
- **`input.schema.json`** — JSON Schema for the input data the skill should accept.
- **`input.example.json`** — A complete worked example matching the reference render.
- **`reference/`** — The canonical implementation:
  - `Renewal Overview.html` — page shell + all CSS
  - `renewal.jsx` — React component (data, tone copy, rendering)
  - `tweaks-panel.jsx` — Tweaks shell (must be inlined into final output)

## How to use it

1. Open Claude Code in a fresh project.
2. Drop this whole `handoff/` folder in.
3. Paste the contents of `PROMPT.md` as your first message.
4. Provide your input JSON (or raw scale-report) as the second message.
5. Claude Code will produce `Renewal Overview - {customer}.html`.

## Iteration

If something looks off, point Claude Code at the specific rule in `SPEC.md` it violated. The spec is the source of truth — if the spec is wrong, fix it in `SPEC.md` first, then have Claude regenerate.
