# Phase 2: Pricing Engine - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Given a validated customer data profile from Phase 1 (UGC used/limit, plan name, pricing, active seats), calculate the optimal base plan + UGC add-on combination that covers the customer's actual usage at the lowest cost, then generate 2 renewal options (annual and multi-year commitment) with appropriate discounts applied.

</domain>

<decisions>
## Implementation Decisions

### Pricing Table (hardcoded in skill file)
- **D-01:** Archive has 3 standard plans. Embed directly in the skill file as a reference table:

  | Plan | Monthly | Annual (10% off) | 2-Year (20% off) | UGC Limit | Credits |
  |------|---------|-------------------|-------------------|-----------|---------|
  | Startup | $500/mo | $5,400/yr ($450/mo) | $9,600/yr ($400/mo) | 500/mo | 20,000/mo |
  | Growth | $1,500/mo | $16,200/yr ($1,350/mo) | $28,800/yr ($1,200/mo) | 2,500/mo | 70,000/mo |
  | Enterprise | $5,000/mo | $54,000/yr ($4,500/mo) | $96,000/yr ($4,000/mo) | 10,000/mo | 150,000/mo |

- **D-02:** UGC Add-on: +500 UGC/mo for $250/mo. Stackable (customer can buy multiple packs). Same discount rates apply (10% annual, 20% 2-year) to add-on pricing.
- **D-03:** Credit add-ons (Pack L $2,500, Pack M $1,250, Pack S $500) and Extra Competitors ($500) exist but are NOT part of the renewal pricing engine scope. Only base plans + UGC add-ons are optimized.

### Discount Rules
- **D-04:** Annual commitment = 10% off monthly rate. Standard SaaS convention.
- **D-05:** Multi-year (2-year) commitment = 20% off monthly rate.
- **D-06:** Discounts apply to both base plan AND UGC add-on packs.
- **D-07:** No volume discounts, no loyalty discounts, no custom pricing. Standard structure only.

### Option Generation
- **D-08:** Generate exactly 2 renewal options: one annual commitment and one 2-year commitment. Both use the same optimal plan + add-on combination, just different discount tiers.
- **D-09:** Each option shows: base plan name, base plan price, number of UGC add-on packs, add-on price, total monthly equivalent, total annual/contract price, savings vs current spend.

### Optimal Combo Calculation
- **D-10:** "Optimal" means the cheapest combination of base plan + UGC add-on packs that covers the customer's current UGC usage (from `pricing_ugc_used` in PostHog groups table). No headroom buffer — match actual usage exactly.
- **D-11:** Algorithm: For each base plan (Startup, Growth, Enterprise), calculate how many UGC add-on packs are needed to cover the gap between the plan's UGC limit and the customer's actual usage. Total cost = base plan price + (packs needed * $250/mo). Pick the cheapest total.
- **D-12:** If usage is 0 or very low, recommend the lowest tier (Startup) with no add-ons.
- **D-13:** If usage exceeds Enterprise (10,000/mo) + reasonable add-on stacking (e.g., >15,000 UGC), note that custom pricing may be needed and surface a warning.

### Data Flow from Phase 1
- **D-14:** Phase 2 consumes the data already fetched in Phase 1's `/scale` run. The skill file adds pricing logic after Step 5 (output). Phase 1's structured data (company name, tier, shop IDs, UGC used/total, plan name, monthly price, annual price, active seats) is available in the conversation context.
- **D-15:** The pricing engine compares the customer's CURRENT plan/price (from Stripe) against the OPTIMAL plan/price (calculated). Savings = current annual spend - recommended annual spend.

### Claude's Discretion
- How to structure the pricing table data internally (object, array, inline)
- How to present the 2 options in the terminal output (cards, table, sequential blocks)
- Edge case handling for customers already on the optimal plan (show "already optimized" message)
- Whether to show the full calculation breakdown or just the final numbers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 Artifacts
- `.claude/commands/scale.md` — Current skill file with identity resolution + data fetch (pricing steps added here)
- `.planning/phases/01-data-layer/01-CONTEXT.md` — Phase 1 decisions (data sources, error handling, UX patterns)
- `.planning/phases/01-data-layer/01-01-SUMMARY.md` — Identity resolution implementation details
- `.planning/phases/01-data-layer/01-02-SUMMARY.md` — Data fetch implementation details

### Pricing Source
- Pricing screenshots captured in this context file (D-01, D-02, D-03)
- No external pricing doc file — all pricing data embedded in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `~/.claude/commands/scale.md` — Phase 1 skill file. Phase 2 adds new steps (pricing calculation + option output) after the existing Step 5 output.

### Key Phase 1 Discovery
- UGC usage comes from PostHog `groups` table (`pricing_ugc_used` / `pricing_ugc_total`), NOT the `events` table
- Stripe lookup uses cascading strategy: stripe_customer_id -> metadata search -> name search
- UGC limit in Stripe is at `price.metadata.features_chunk0` -> `core.media_items_monthly_limit`
- PostHog groups table is the database source of truth for UGC, not Stripe metadata

### Integration Points
- New steps added to `~/.claude/commands/scale.md` after existing Step 5
- Consumes data already in conversation context from Steps 1-5

</code_context>

<specifics>
## Specific Ideas

- The UGC add-on is $250/mo for +500 UGC and is stackable — a customer needing 1,200 UGC could do Startup (500) + 2 packs (1,000) = 1,500 UGC coverage at $500 + $500 = $1,000/mo, cheaper than Growth at $1,500/mo
- The interesting optimization is finding where the crossover point is between "base plan + many add-ons" vs "next tier up"
- Crossover example: Startup + 4 packs = 2,500 UGC at $1,500/mo = same as Growth. So at 2,500 UGC, Growth is better (same price, more credits). Below 2,500, Startup + packs may win.

</specifics>

<deferred>
## Deferred Ideas

- Credit pack optimization (not in scope — only UGC packs)
- Custom pricing for accounts exceeding Enterprise tier significantly
- Historical pricing comparison (what they paid last 12 months vs recommended)

</deferred>

---

*Phase: 02-pricing-engine*
*Context gathered: 2026-04-28*
