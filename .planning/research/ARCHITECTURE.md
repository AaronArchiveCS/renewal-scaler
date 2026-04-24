# Architecture Research

**Domain:** Claude Code skill — multi-API data aggregation + pricing logic + HTML output
**Researched:** 2026-04-23
**Confidence:** HIGH (based on established patterns from qbr-deck.md and daily-brief.md skills in the same environment)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Claude Code Skill Layer                          │
│                      ~/.claude/commands/scale.md                     │
│                                                                      │
│  Input: "$ARGUMENTS" (company name or shop ID)                       │
│  Orchestrator: Claude — reads skill, drives all steps               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Step 1: Resolve identity
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Identity Resolution Layer                        │
│                                                                      │
│  Input: company name OR shop ID                                      │
│  HubSpot MCP → resolve company → extract shop ID                    │
│  Output: canonical { shop_id, company_name, hubspot_company_id }    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Step 2: Parallel data fetch
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Data Fetching Layer                            │
├───────────────┬───────────────────────┬─────────────────────────────┤
│  PostHog MCP  │     HubSpot MCP       │        Stripe MCP           │
│               │                       │                             │
│  UGC usage    │  Current plan         │  Billing interval           │
│  (3mo avg)    │  UGC limit field      │  MRR / ARR                  │
│  Active users │  Active seats         │  Current price              │
│  Workspaces   │  Renewal date         │  Subscription ID            │
└───────┬───────┴──────────┬────────────┴──────────────┬──────────────┘
        │                  │                            │
        └──────────────────┴─────────────┬──────────────┘
                                         │ Step 3: Assemble raw profile
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data Assembly Layer                             │
│                                                                      │
│  Merge data from all 3 sources into a unified customer profile:      │
│  { shop_id, company_name, plan_tier, ugc_limit, ugc_used_3mo_avg,   │
│    active_users, total_seats, workspaces, current_mrr, current_arr,  │
│    billing_interval, renewal_date }                                  │
│                                                                      │
│  Flag gaps: any missing field → mark as "Data not available"         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Step 4: Run pricing engine
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Pricing Engine Layer                            │
│                                                                      │
│  Input: customer profile + embedded pricing table (in skill file)    │
│                                                                      │
│  Logic:                                                              │
│  1. Calculate required UGC capacity (usage + headroom buffer)        │
│  2. For each plan tier: find cheapest plan + add-on combination      │
│     that covers required capacity                                    │
│  3. Apply discount matrix (monthly, annual, multi-year)              │
│  4. Compute savings vs current spend for each option                 │
│  5. Classify utilization signal (underpaying, at-ceiling, overpaying)│
│                                                                      │
│  Output: 3 renewal options, each with:                               │
│  { plan_tier, ugc_addons, commitment_type, monthly_price,           │
│    annual_total, savings_vs_current, utilization_signal }            │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ Step 5: Render HTML
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     HTML Template Layer                              │
│                                                                      │
│  Input: customer profile + 3 priced options                          │
│  Claude renders inline HTML as a code block or file                  │
│                                                                      │
│  Sections:                                                           │
│  - Header: company name, run date, CSM name                          │
│  - Usage Summary: current plan, usage vs limit, utilization signal   │
│  - 3 Option Cards: plan, add-ons, commitment, price, savings badge   │
│  - Insights callout: why each option fits                            │
│                                                                      │
│  Output: single self-contained HTML string (inline CSS, no deps)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Skill orchestrator | Parse input, drive step order, handle errors, call MCP tools | Claude reading scale.md |
| Identity resolver | Map company name or shop ID → canonical identity with all cross-system IDs | HubSpot company search + property extraction |
| PostHog fetcher | Pull 3-month rolling UGC average, active user count, workspace count | HogQL queries via PostHog MCP |
| HubSpot fetcher | Pull plan tier, UGC limit, seats, renewal date | CRM property read via HubSpot MCP |
| Stripe fetcher | Pull current MRR/ARR, billing interval, subscription status | Stripe customer/subscription lookup |
| Data assembler | Merge 3 API responses, flag gaps, build unified profile | Inline logic in skill |
| Pricing engine | Calculate optimal plan+add-on combos, apply discounts, compute savings | Embedded in skill as explicit decision rules |
| HTML renderer | Convert options into a visually structured, saveable HTML document | Claude-generated inline HTML block |

## Recommended Project Structure

```
~/.claude/commands/
└── scale.md                    # The entire skill — all steps, all logic, pricing table

renewal-scaler/
├── .planning/                  # GSD planning
│   ├── PROJECT.md
│   └── research/
├── pricing/
│   └── pricing-table.md        # Source of truth for Archive plan pricing
│                               # (referenced in skill, updated independently)
└── examples/
    └── sample-output.html      # Reference output for visual validation
```

### Structure Rationale

- **scale.md is the single artifact.** The skill file is the product. Everything else is supporting material.
- **pricing/pricing-table.md is separate.** Pricing changes independently of skill logic. Keeping it in a dedicated file lets Aaron update prices without re-reading the full skill.
- **examples/ for validation.** A reference HTML file lets you verify visual output without running the skill.

## Architectural Patterns

### Pattern 1: Parallel Fan-out with Sequential Assembly

**What:** All API calls (PostHog, HubSpot, Stripe) run simultaneously in Step 2, then Claude waits for all results before proceeding to pricing logic. This is the same pattern used in qbr-deck.md and daily-brief.md.

**When to use:** Any step where inputs are independent of each other.

**Trade-offs:** Faster overall execution. No dependency risk. Claude handles this natively — just instruct "run these in parallel."

**Example (from skill prose):**
```
### Step 2: Fetch Usage and Plan Data (run in parallel)

**PostHog — UGC usage:**
[HogQL query]

**HubSpot — Plan and limits:**
[property read]

**Stripe — Billing:**
[subscription lookup]

Wait for all three before proceeding.
```

### Pattern 2: Embedded Pricing Table, Not External API

**What:** Archive's pricing structure is embedded directly in the skill file as a structured data block. The pricing engine reads from this embedded table, not from an external source.

**When to use:** When pricing data is stable enough for a CSM to trust for a quarter, and there's no pricing API available.

**Trade-offs:** Simple to reason about. No extra API call. Requires manual update when prices change. Acceptable for internal tooling with a small team maintaining it.

**Example:**
```
## Pricing Reference (embedded in skill)

| Plan | UGC Limit | Monthly | Annual |
|------|-----------|---------|--------|
| Startup | 500 | $X | $Y |
| Growth | 2,500 | $X | $Y |
| [Top tier] | [limit] | $X | $Y |

### UGC Add-on Packs
| Pack | UGC Added | Monthly | Annual |
|------|-----------|---------|--------|
| [size] | [ugc] | $X | $Y |
```

### Pattern 3: Identity Resolution as a Dedicated First Step

**What:** Before any data fetch runs, a separate step resolves the input (company name or shop ID) into a canonical identity object containing all cross-system IDs. This prevents ambiguity from propagating into later steps.

**When to use:** Any time the input is fuzzy (company name) or the skill touches multiple systems with different ID schemes.

**Trade-offs:** Adds one serial step before parallel fetches. Worth the tradeoff — a bad identity match corrupts all downstream data silently.

**Example:**
```
### Step 1: Resolve Identity

Search HubSpot for the company by name (if name provided) or look up by
shop ID custom property (if ID provided).

Extract and confirm:
- company_name (canonical)
- shop_id (primary cross-system key)
- hubspot_company_id (for any follow-up HubSpot calls)

If no match found or multiple ambiguous matches, stop and ask the user
to clarify before proceeding.
```

### Pattern 4: Inline Pricing Engine as Explicit Decision Rules

**What:** The pricing optimization logic is written as explicit if/then decision rules in the skill prose, not as code. Claude executes the logic against the assembled customer profile.

**When to use:** When the logic is deterministic enough to specify in rules but not complex enough to warrant a separate script.

**Trade-offs:** Readable by non-engineers. Easy to audit and update. Cannot be unit-tested independently. Appropriate for a ~3-plan pricing structure with a handful of add-on tiers.

**Example:**
```
### Step 3: Calculate Renewal Options

For each option, follow this logic:

1. Determine required UGC capacity:
   - Required = ugc_used_3mo_avg * 1.2 (20% headroom buffer)

2. Find minimum-cost plan + add-on combination:
   - Start with the cheapest plan that covers required capacity alone
   - If cheapest plan overshoots significantly, check if a lower plan
     + add-on pack is cheaper total
   - Choose whichever costs less

3. Generate 3 options varying commitment:
   - Option A: Month-to-month (highest flexibility, highest cost)
   - Option B: Annual (recommended, balanced)
   - Option C: Multi-year if available (lowest cost, highest lock-in)

4. For each option, compute savings vs current ARR:
   - savings = current_arr - option_annual_total
   - If negative (customer pays more), label as "investment to right-size"
```

## Data Flow

### Execution Flow

```
User types: /scale "Acme Co"
    |
    v
[Scale skill loads — Claude reads ~/.claude/commands/scale.md]
    |
    v
[Step 1: Identity resolution — serial]
HubSpot search: "Acme Co" → company record
Extract: shop_id, hubspot_company_id, company_name
    |
    v (fail fast: if no match → ask user to clarify, stop)
    v
[Step 2: Parallel data fetch]
PostHog ──────────────────────────────────────────────────┐
  HogQL: UGC events (3mo avg)                             │
  HogQL: auth.user.logged_in distinct users               │
  HogQL: shop IDs (workspace count)                       │
                                                          ├──→ [Step 3: Assemble profile]
HubSpot ──────────────────────────────────────────────────┤
  Company properties: plan_tier, ugc_limit,               │       Merge all API responses
  active_seats, renewal_date                              │       Flag any missing fields
                                                          │
Stripe ────────────────────────────────────────────────── ┘
  Subscription: MRR, ARR, billing_interval
    |
    v
[Step 4: Pricing engine — inline logic]
Calculate required UGC capacity
Find cheapest plan + add-on combos
Apply discount matrix
Compute savings vs current spend
Classify utilization signal
Output: 3 options
    |
    v
[Step 5: HTML rendering]
Claude generates self-contained HTML string
Inline CSS, no external dependencies
Sections: header, usage summary, 3 option cards, insights
    |
    v
Output delivered in Claude Code chat
CSM copies HTML → saves as .html → opens in browser or prints to PDF
```

### Key Data Flows

1. **Identity flow:** User input (fuzzy) → HubSpot lookup → canonical `{ shop_id, company_name, hubspot_company_id }` — all subsequent calls use `shop_id` as the universal key
2. **Usage flow:** PostHog events filtered by `shop_id` and 3-month date window → aggregate counts → `ugc_used_3mo_avg`, `active_users`, `workspace_count`
3. **Plan/billing flow:** HubSpot properties → `plan_tier`, `ugc_limit`, `seats`; Stripe subscription → `current_mrr`, `billing_interval`
4. **Pricing flow:** Customer profile + embedded pricing table → pricing engine → 3 options with savings calculations
5. **Output flow:** 3 options → HTML template → rendered string → CSM copies and saves locally

## Scaling Considerations

This is a single-user CLI tool for a team of 4 CSMs. Scaling is not a concern. The relevant constraints are:

| Concern | Constraint | Mitigation |
|---------|------------|------------|
| API latency | PostHog HogQL queries can be slow for large event volumes | Parallel fan-out in Step 2 — all 3 APIs called simultaneously |
| Pricing staleness | Embedded pricing table goes stale when Archive changes prices | Keep pricing in a separate `pricing-table.md` file; update it before CSMs run the skill for a new cycle |
| Missing data | Not all customers have all fields populated in HubSpot | Explicit "Data not available" handling with clear labeling in output |
| Identity ambiguity | Company name search in HubSpot may return multiple matches | Fail fast in Step 1 — surface matches to CSM and ask for clarification before proceeding |

## Anti-Patterns

### Anti-Pattern 1: Fetching Everything Before Resolving Identity

**What people do:** Start data fetches immediately when input arrives, assuming the input is clean.

**Why it's wrong:** If company name is ambiguous or shop ID is wrong, all API calls return incorrect or empty data — and the error is silent. The output looks valid but contains wrong numbers.

**Do this instead:** Resolve identity to a confirmed canonical `shop_id` in Step 1 before any other API call. Fail fast with a clear message if resolution is uncertain.

### Anti-Pattern 2: Hardcoding Pricing Inside Skill Logic

**What people do:** Embed pricing numbers inline throughout the pricing engine decision rules.

**Why it's wrong:** When Archive changes prices (which happens), you have to hunt through skill logic to find and update numbers. High risk of inconsistency.

**Do this instead:** Put all pricing data in a single embedded table at the top of the skill (or in a referenced `pricing-table.md`). The pricing engine reads from the table; the table is the only thing you update when prices change.

### Anti-Pattern 3: Separate Scripts for Pricing Logic

**What people do:** Write a Node.js or Python script for the pricing engine and have the skill invoke it.

**Why it's wrong:** Adds a build step, a runtime dependency, and complexity. Claude Code skills are self-contained markdown files — the moment you add an external script, you've broken the "runs anywhere" property and added setup overhead for a 4-person team.

**Do this instead:** Write pricing logic as explicit prose decision rules. Claude executes the rules. For a 3-tier plan structure with handful of add-ons, this is entirely sufficient.

### Anti-Pattern 4: HTML with External CSS Dependencies

**What people do:** Reference a stylesheet, CDN, or framework in the HTML output.

**Why it's wrong:** The output HTML needs to work when opened directly from the filesystem, emailed, or printed to PDF. External dependencies break in those contexts.

**Do this instead:** Generate self-contained HTML with all styles inlined. No `<link>` tags, no CDN scripts. The whole document should open correctly with no internet connection.

## Integration Points

### External Services

| Service | Integration Pattern | Key Detail |
|---------|---------------------|------------|
| PostHog | MCP tool (`mcp__claude_ai_PostHog__query-run`) with HogQL queries | Filter all queries by `properties.shop_id = '{shop_id}'`. US region: `https://us.posthog.com`. Project ID: `192859`. |
| HubSpot | MCP tool (`mcp__claude_ai_HubSpot__search_crm_objects` + property reads) | `shop_id` custom property name TBD (Aaron to confirm). May require 2-3 serial calls: search → company ID → properties. |
| Stripe | MCP tool (if available) or direct REST | `shop_id` as customer metadata key. Pull subscription + price object. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Skill → PostHog | MCP tool call with HogQL query string | Queries are inline in skill. Build and test queries independently before embedding. |
| Skill → HubSpot | MCP tool call — search then property read | Confirm exact custom property names for UGC limit and shop ID before writing skill (open item in PROJECT.md). |
| Skill → Stripe | MCP tool call | Confirm Stripe MCP availability. Fallback: instruct Claude to ask CSM for current MRR if Stripe MCP unavailable. |
| Step 3 → Step 4 | In-context data object | Pricing engine reads assembled profile from Claude's context, not a file or variable. |
| Step 4 → Step 5 | In-context option array | HTML renderer reads the 3 options Claude just computed. Same conversation context, no handoff mechanism needed. |

## Build Order

Dependencies drive this order:

1. **Pricing table first.** Can't write the pricing engine until you know the plan structure, add-on tiers, and discount rules. Aaron to provide the full pricing document before Phase 1.

2. **HubSpot field resolution second.** Shop ID custom property name and UGC limit field name are open items. Confirm these before writing the data fetching steps — wrong field names cause silent null returns.

3. **Identity resolver third.** Once HubSpot field names are known, write and test the Step 1 identity resolution logic. Validate with 2-3 real accounts.

4. **Data fetching fourth.** Write PostHog HogQL queries and validate output. Write HubSpot and Stripe fetches. Test all three against a real account.

5. **Pricing engine fifth.** With real data validated, write the optimization rules against the confirmed pricing table. Manually verify output for 2-3 accounts with known plans.

6. **HTML template last.** Output format is the least critical dependency. Build it after the data and logic layers are confirmed correct.

## Sources

- `/Users/aaronrampersad/.claude/commands/qbr-deck.md` — established pattern for parallel MCP fan-out in Claude Code skills (HIGH confidence, same environment)
- `/Users/aaronrampersad/.claude/commands/daily-brief.md` — established pattern for multi-source data aggregation in Claude Code skills (HIGH confidence, same environment)
- `/Users/aaronrampersad/renewal-scaler/.planning/PROJECT.md` — requirements, constraints, open items
- PostHog API access memory — US region, project 192859, HogQL query pattern (HIGH confidence)
- CS360 project memory — `shop_id` as universal cross-system key, PostHog SDK is write-only so HogQL Query API required for reads (HIGH confidence)

---
*Architecture research for: Claude Code skill — CSM renewal pricing tool*
*Researched: 2026-04-23*
