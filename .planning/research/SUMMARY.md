# Project Research Summary

**Project:** Renewal Scaler — Claude Code skill (`/scale`)
**Domain:** Internal CSM tool — multi-API data aggregation + pricing optimization + HTML output
**Researched:** 2026-04-23
**Confidence:** HIGH

## Executive Summary

The Renewal Scaler is a bespoke internal Claude Code skill that automates pre-renewal pricing prep for CSMs. The architecture pattern is well-established within Archive's own toolchain (qbr-deck.md, daily-brief.md) and follows a clear 5-step flow: resolve identity via HubSpot, fan out to PostHog + Stripe + HubSpot in parallel, assemble a unified customer profile, run a pricing optimization engine against an embedded pricing table, and render a self-contained HTML output document. The entire skill lives in a single `scale.md` file — no server, no build step, no external deployment. The MCP-based integration approach means Claude drives all API calls natively, keeping the skill portable and maintainable by a non-engineering team.

The recommended stack is deliberately minimal: no custom Node.js script is needed because the pricing logic can be expressed as explicit prose decision rules that Claude executes directly. The only dependencies are the existing MCP integrations (HubSpot, Stripe, PostHog) that Claude Code already has available. The key differentiating feature — finding the cheapest combination of base plan and UGC add-on packs that covers actual 3-month rolling usage — is implementable as explicit if/then rules in skill prose, not code. This keeps the skill auditable and updatable without engineering involvement.

The highest-risk area is identity resolution: company name inputs are fuzzy, HubSpot can have duplicate records, and a silent wrong-customer match produces plausible-looking but entirely incorrect pricing output. This must be solved first and solved defensively — always confirm the resolved shop ID before touching any data. The second major risk is that two open items from PROJECT.md (exact HubSpot field names for UGC limit and shop ID, and the Stripe MCP availability confirmation) must be resolved before Phase 1 coding begins. If these are guessed rather than confirmed, all downstream fetch logic is built on the wrong foundation.

## Key Findings

### Recommended Stack

The skill is a pure Claude Code markdown file — no Node.js script, no build pipeline. Claude reads `~/.claude/commands/scale.md` and drives all execution using MCP tool calls. All three data sources (PostHog, HubSpot, Stripe) are accessed via MCP. PostHog analytics queries use the HogQL REST endpoint directly (via `fetch` or MCP) since the PostHog Node SDK is event-capture-only and has no query method. HTML output is a self-contained string with inline CSS — no external stylesheets, no CDN dependencies.

**Core technologies:**
- Claude Code skill (`scale.md`): Delivery mechanism — single file, invoked via `/scale [company or shop ID]`, drives all steps via MCP tool calls
- PostHog MCP + HogQL Query API: UGC usage pull — `POST /api/projects/192859/query` with 3-month date window and `properties.shop_id` filter
- HubSpot MCP: Identity resolution + plan/seat data — company search to resolve name → shop ID, then property reads for plan tier, UGC limit, renewal date
- Stripe MCP: Billing baseline — subscription lookup by customer metadata `shop_id`, normalizing to monthly equivalent (check `interval` always)
- ES6 template literals + inline CSS: HTML output — self-contained, no dependencies, works offline, printable to PDF via browser

**What NOT to use:** posthog-node SDK (capture-only), puppeteer/playwright for PDF (heavyweight), N8N workflow (wrong primitive), external CSS frameworks in HTML output (break offline use).

### Expected Features

**Must have (table stakes — P1, all needed for tool to be useful):**
- Customer identity resolution: company name OR shop ID → canonical shop ID + confirmation shown in output header
- Current plan + price from Stripe: baseline for all savings framing
- 3-month UGC rolling average from PostHog: primary sizing input for all recommendations
- Optimal plan + add-on combination calculation: cheapest bundle covering usage + 20% headroom — the core differentiating intelligence
- 3 renewal options with annual vs monthly pricing: standard renewal conversation format with $ savings called out
- Utilization state detection: overpaying (<50%), well-matched (50-85%), ceiling risk (>85%)
- Clean HTML output: one card per option, recommended option marked, current state baseline at top

**Should have (P2, add after initial validation):**
- Recommended option highlighted with explicit rationale (not just cheapest — flagged if it represents a downgrade)
- Utilization insight narrative: plain-language interpretation of what the data means
- Commitment-based discount modeling: monthly vs annual vs multi-year options
- Active seats and workspace data: when HubSpot field names confirmed
- Savings vs current spend framing: "Save $X/year" in dollar amounts, not percentages

**Defer to v2+:**
- Usage trend direction (requires time-series query, not just rolling avg)
- Multi-workspace rollup (confirm workspace = shop ID question first)
- Pricing structure version control (defer until pricing changes frequently enough to cause errors)

**Anti-features to reject explicitly:** client-facing output formatting, HubSpot writeback, Slack bot interface, historical chart rendering, email/PDF send from tool.

### Architecture Approach

The skill follows a 5-step sequential-then-parallel flow that is proven in Archive's existing Claude Code skills. Step 1 (identity resolution) is always serial — it must complete before any other API call. Steps 2A/2B/2C (PostHog, HubSpot, Stripe data fetches) run in parallel via `Promise.all()` or parallel MCP tool calls after shop ID is confirmed. Steps 3-5 (assemble profile, run pricing engine, render HTML) are serial and execute in Claude's context window — no external scripts needed.

**Major components:**
1. Identity Resolver — HubSpot company search → canonical `{ shop_id, company_name, hubspot_company_id }`; fail fast with clarification request if ambiguous
2. Data Fetcher (parallel fan-out) — PostHog HogQL for UGC rolling avg + active users; HubSpot properties for plan tier + UGC limit + seats; Stripe subscription for current MRR/ARR + billing interval
3. Data Assembler — merge all 3 API responses into unified customer profile; flag missing required fields as explicit errors (never silently treat null as 0)
4. Pricing Engine — embedded pricing table + explicit decision rules; calculate required capacity (usage * 1.2 headroom), find cheapest plan+add-on combo, apply discount matrix, classify utilization signal, produce 3 options
5. HTML Renderer — self-contained output: current state header, 3 option cards with price derivation shown, utilization insight, data source/timestamp footer

**Key patterns:** parallel fan-out after identity confirmation (not before), embedded pricing table at top of skill (single update point), inline decision rules instead of external scripts, explicit error banners for missing data.

### Critical Pitfalls

1. **Silent wrong-customer identity match** — Company name resolution via HubSpot can match duplicates, rebranded clients, or parent companies. Prevention: always surface all HubSpot matches when count > 1 and require explicit CSM confirmation; show resolved shop ID in output header; never silently pick first result.

2. **Missing API data generates plausible-looking but wrong output** — If PostHog, HubSpot, or Stripe returns null/error, tool must not proceed to pricing generation. Prevention: define required fields (plan, price, UGC usage) vs optional (seats, workspaces); if required field missing, show red error banner and stop — do not output pricing options.

3. **UGC limit source-of-truth disagreement between HubSpot and Stripe** — Both systems may claim different UGC limits for the same customer (custom contracts, manual overrides, migration lag). Prevention: decide the single canonical source before writing any fetch logic (Stripe recommended as billing system of record); null field = explicit warning in output, not silent default.

4. **Discount stacking in wrong order corrupts every output option** — Multiplicative vs additive discount application produces different numbers. Prevention: document exact discount order in pricing config before writing any calculation logic; show price derivation breakdown in HTML for every option so CSMs can spot anomalies.

5. **Uncontextualized downgrade recommendation destroys trust** — A client using 30% of their plan due to seasonal dip gets a "recommended" downgrade that the CSM cannot explain. Prevention: never label an option as recommended if it is below the current plan tier; always show 3 options with distinct rationales (cost-optimized, right-sized for trend, status quo); surface utilization insight line.

## Implications for Roadmap

Based on the dependency graph from FEATURES.md, build order from ARCHITECTURE.md, and pitfall phasing from PITFALLS.md:

### Phase 1: Foundation and Data Layer

**Rationale:** Identity resolution is the root dependency for everything — no other step can proceed without a confirmed shop ID. Two open items from PROJECT.md (HubSpot custom property names for shop ID and UGC limit, Stripe MCP availability) must also be resolved before writing any data fetch logic. Getting this wrong silently corrupts all downstream output.

**Delivers:** Confirmed skill skeleton with identity resolution that surfaces all HubSpot matches, parallel data fetch from all 3 APIs with explicit required-field validation, and a unified customer profile object with clear error handling for null fields.

**Addresses:** Identity resolution (table stakes P1), Stripe plan/price pull (P1), PostHog UGC rolling average (P1)

**Avoids:** Pitfall 1 (silent wrong-customer match), Pitfall 4 (UGC limit source disagreement), Pitfall 6 (missing data silent failure), Pitfall 8 (sequential API slowness)

**Must do first:** Confirm HubSpot custom property name for shop ID. Confirm HubSpot field name for UGC limit. Confirm Stripe MCP is available (fallback: prompt CSM for current MRR). Establish single source of truth for UGC limit.

### Phase 2: Pricing Engine

**Rationale:** Pricing logic cannot be written until real data from Phase 1 is validated for 2-3 real accounts. The optimal plan+add-on calculation is the core differentiating feature — building it before data is confirmed means testing against assumptions, not reality. Pricing table must also be embedded as a single top-of-file block before any engine logic is written.

**Delivers:** Pricing optimization rules (cheapest plan+add-on combo covering usage + 20% headroom), 3 option generation with commitment-based discount modeling, utilization signal classification (overpaying/well-matched/ceiling risk), savings vs current spend calculation.

**Uses:** Embedded pricing table (single source of truth), integer cents arithmetic (no floating point), explicit discount application order (confirmed from pricing doc)

**Implements:** Pricing Engine layer from architecture

**Avoids:** Pitfall 3 (discount stacking wrong order), Pitfall 5 (downgrade without context), Pitfall 7 (cent-level rounding errors)

### Phase 3: HTML Output and Polish

**Rationale:** Output format is the least critical dependency and should be built last — after the data and pricing logic are confirmed correct against real accounts. The HTML template is straightforward but must be tested in browser print view before shipping to CSMs.

**Delivers:** Self-contained HTML output with current state header (plan + usage + utilization %), 3 option cards (with price derivation shown), recommended option highlighted (but never if it's a downgrade), error banner at top for any missing data, print-ready CSS.

**Implements:** HTML Template layer; surfaces all output-layer UX pitfalls from PITFALLS.md

**Avoids:** Pitfall 5 (downgrade recommendation labeling), UX pitfalls (savings in dollar amounts not %, current state baseline visible, print-ready output, error banners at top not bottom)

### Phase Ordering Rationale

- Identity resolution must be serial before any data fetch — this is a hard dependency, not a preference. Getting it wrong corrupts everything downstream silently.
- Phase 1 must be validated on real accounts (2-3 test runs) before Phase 2 begins — the pricing engine is only as good as the data it runs on.
- Phase 3 (HTML) is deliberately last because it adds no value until Phases 1-2 are confirmed correct. Don't invest in polish before the math is right.
- The 3-phase structure matches the natural dependency chain: get data → process data → present data.

### Research Flags

Phases likely needing deeper research or pre-flight confirmation during planning:
- **Phase 1:** Two open items from PROJECT.md must be resolved before writing code — HubSpot custom property names (shop ID field, UGC limit field) and Stripe MCP tool availability. These are not researchable from the outside; Aaron must confirm them from internal data. Flag as a blocker.
- **Phase 2:** Exact Archive pricing structure (plan tiers, UGC add-on pack sizes, discount rates for annual vs multi-year) must be provided before writing the pricing engine. The engine is only correct if the embedded pricing table is correct.

Phases with standard patterns (skip research-phase):
- **Phase 3 (HTML output):** Well-established pattern from existing Archive skills. Self-contained HTML with inline CSS is a solved problem; no additional research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against npm registry, official SDK docs, Claude Code skill documentation. MCP-only approach confirmed against existing Archive skill patterns (qbr-deck.md, daily-brief.md). PostHog SDK read-only limitation confirmed. |
| Features | HIGH | Grounded in PROJECT.md requirements (primary source) + CPQ/CS platform comparison research. Feature dependency graph is internally consistent. Anti-features well-justified. |
| Architecture | HIGH | Directly derived from existing Archive Claude Code skills in the same environment. Parallel fan-out pattern, embedded pricing table, and identity-first ordering are all battle-tested patterns. |
| Pitfalls | HIGH | Domain-specific, drawn from observed failure modes in Aaron's own CS toolchain (CS Control Center, CS360, HubSpot partial backfill). Stripe/PostHog API gotchas are official SDK documentation patterns. |

**Overall confidence:** HIGH

### Gaps to Address

These are not research gaps — they are open items that require Aaron or the Archive team to provide information that external research cannot resolve:

- **HubSpot custom property names:** The exact API field names for shop ID and UGC limit in HubSpot are unknown. Must be confirmed before Phase 1 data fetch logic is written. Wrong field names return null silently.
- **Stripe MCP availability:** The Stripe MCP integration needs to be confirmed as available in Claude Code. If unavailable, the fallback pattern (prompt CSM for current MRR) must be incorporated into Phase 1 design.
- **Full pricing table:** Plan tiers, exact UGC limits per tier, add-on pack sizes and prices, and discount rates (annual, multi-year) must be provided before Phase 2 can begin. The pricing engine is only correct if these numbers are correct.
- **UGC source of truth decision:** Stripe vs HubSpot as canonical UGC limit source must be decided and documented before Phase 1 fetch logic is written. Recommendation: use Stripe (billing system of record).

## Sources

### Primary (HIGH confidence)
- `/Users/aaronrampersad/.claude/commands/qbr-deck.md` — established parallel MCP fan-out pattern, same environment
- `/Users/aaronrampersad/.claude/commands/daily-brief.md` — established multi-source aggregation pattern, same environment
- `/Users/aaronrampersad/renewal-scaler/.planning/PROJECT.md` — primary requirements and open items
- PostHog API access memory (project 192859, US region, HogQL query pattern)
- `npm show stripe version` → 22.1.0 (confirmed live)
- `npm show @hubspot/api-client version` → 13.5.0 (confirmed live)
- Claude Code Skills documentation — SKILL.md format, `$ARGUMENTS`, `allowed-tools`, `!` bash injection

### Secondary (MEDIUM confidence)
- PostHog Node.js SDK docs — confirmed SDK is capture-only; Query API is REST-only (page partially rendered)
- PostHog Query API reference — HogQL endpoint structure
- Gainsight, ChurnZero, Planhat feature comparison — CPQ/CS renewal tool competitive landscape

### Tertiary (context-informed)
- Archive CS Control Center build — HubSpot partial backfill pattern (1/19 churn fields populated), observed failure mode directly relevant to Pitfall 6
- CS360 project memory — shop_id as universal cross-system key confirmed

---
*Research completed: 2026-04-23*
*Ready for roadmap: yes*
