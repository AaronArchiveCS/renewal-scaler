# Phase 1: Data Layer - Research

**Researched:** 2026-04-27
**Domain:** Claude Code skill authoring + MCP tool orchestration (HubSpot, Stripe, PostHog)
**Confidence:** HIGH — all key findings verified against live project files, permissions config, and official Claude Code documentation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Identity Resolution**
- D-01: Name search goes to HubSpot only. Once a company is confirmed, use the shop ID from HubSpot to cross-reference Stripe and PostHog.
- D-02: When multiple companies match a name search, show a numbered list (max 5) with key details (name, shop ID, plan). If >5 matches, ask the CSM to re-run with a shop ID.
- D-03: When CSM provides a shop ID directly, always confirm the match — show resolved company name and ask "Is this [Company Name]?" before proceeding.
- D-04: CSM selects one HubSpot company record. Tool extracts all shop IDs from that record's shop ID field. Then asks the CSM: "Does this customer have other workspaces we should include?" — CSM can add additional shop IDs manually.

**Data Source Mapping**
- D-05: UGC limit source of truth is Stripe (billing system) — pull from subscription metadata or product details.
- D-06: UGC usage (3-month rolling average) comes from PostHog.
- D-07: Active seats come from PostHog — count distinct users with activity.
- D-08: Current plan name and pricing (monthly and annual) come from Stripe.
- D-09: Workspace = shop ID. One customer can have multiple shop IDs.
- D-10: Shop ID field on HubSpot companies can contain multiple IDs in a single field. Format TBD — must check HubSpot to determine delimiter.
- D-11: For multi-workspace customers, aggregate data across ALL shop IDs from the selected company record plus any additional IDs the CSM provides.
- D-12: Usage trend calculated month-over-month — compare each of the last 3 months sequentially. If 2 out of 3 months are increasing, classify as "growing." Same logic for declining. Otherwise "stable."

**Missing Data Handling**
- D-13: Hard-stop on critical fields: plan name, current price, and UGC usage. If any are missing or null, stop and surface an explicit error. Secondary fields (seats, workspaces) warn and continue.
- D-14: Error messages include the field name AND where to fix it.
- D-15: If any API is down or times out, fail fast with a clear message naming which system is unreachable. No silent retries.

**Skill UX & Output**
- D-16: Step-by-step progress updates during data fetch.
- D-17: Phase 1 standalone output is a structured text summary with all fields.
- D-18: No extra flags for v1 — just `/scale [name or shop ID]`.

### Claude's Discretion
- Exact PostHog queries for UGC usage aggregation and distinct user counting
- How to structure the internal data object that Phase 2 will consume
- Progress update formatting and timing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDENT-01 | CSM can trigger `/scale` with a company name and get results | HubSpot `search_crm_objects` tool searches by name on companies objectType |
| IDENT-02 | CSM can trigger `/scale` with a shop ID and get results | HubSpot `search_crm_objects` with filter on `shop_id` property |
| IDENT-03 | Tool resolves customer identity consistently across PostHog, Stripe, and HubSpot | shop_id is the universal key; HubSpot is authoritative identity source, then fan out |
| IDENT-04 | Tool surfaces disambiguation options when multiple companies match a name search | Skill prompts Claude to present numbered list, ask CSM to select, then proceed |
| DATA-01 | Tool pulls UGC usage from PostHog as a 3-month rolling average | HogQL via `mcp__claude_ai_PostHog__query-run`; event = `crm.shop_item.created` filtered by `shop_id`, grouped by month |
| DATA-02 | Tool pulls UGC limit from Stripe or HubSpot (field TBD — D-05 says Stripe) | Stripe subscription metadata via `search_stripe_resources` or `list_subscriptions` |
| DATA-03 | Tool pulls current plan name and pricing (monthly and annual) from Stripe | Stripe subscription + product/price objects via `fetch_stripe_resources` |
| DATA-04 | Tool pulls number of active seats (active users) | PostHog HogQL: COUNT(DISTINCT person_id) on auth/pageview events per shop_id, 30-90d window |
| DATA-05 | Tool pulls number of workspaces (shop IDs) | Count of shop IDs extracted from HubSpot record plus any additional CSM-provided IDs |
| DATA-06 | Tool shows usage trend direction (growing, stable, or declining) | Per-month UGC counts for last 3 months; compare month-over-month per D-12 |
</phase_requirements>

---

## Summary

This phase builds a Claude Code skill (`/scale`) that resolves customer identity and returns a validated data profile. The skill is a markdown prompt file, not application code. It orchestrates MCP tool calls to HubSpot, Stripe, and PostHog — all three are confirmed available in this Claude Code environment with specific tool names already in the permissions allowlist.

The identity resolution flow uses HubSpot as the authoritative source (name or shop ID → company record → extract shop IDs), then fans out in parallel to Stripe for billing and PostHog for usage. Interactive disambiguation is native to Claude Code: the skill instructs Claude to ask the CSM a question and wait for their response before continuing. No special mechanism is needed — Claude handles this naturally within the conversation flow.

The primary unknowns going into planning are (1) the exact Stripe data structure for plan/price/UGC limit (must be discovered live during execution), and (2) whether the HubSpot `shop_id` field contains multiple values and if so what delimiter. Both require a live MCP tool call to confirm and are documented as execution-time discoveries.

**Primary recommendation:** Structure the skill as two sequential phases within a single `/scale` command — identity resolution (HubSpot only, interactive) followed by parallel data fetch (PostHog + Stripe simultaneously) — with explicit progress updates between each step.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Identity resolution (name search) | HubSpot MCP | — | HubSpot is the CRM; company names and shop IDs live there |
| Identity confirmation (disambiguation) | Claude conversation | — | Native Claude behavior — skill instructs Claude to ask user, no special mechanism needed |
| UGC usage (3-month rolling avg) | PostHog MCP | — | PostHog is the product analytics system; all event data lives here |
| UGC limit | Stripe MCP | — | D-05 locks this to Stripe as billing system of record |
| Plan name and pricing | Stripe MCP | — | D-08 locks this to Stripe |
| Active seats | PostHog MCP | — | D-07 locks this to PostHog distinct user count |
| Workspace count | HubSpot MCP | CSM input | shop_id field on HubSpot company record; CSM may add additional IDs |
| Usage trend calculation | Skill logic (Claude) | — | Claude performs the month-over-month comparison from PostHog monthly data |
| Progress updates | Skill prompt instructions | — | Claude narrates each step per D-16 |
| Error surfacing | Skill prompt instructions | — | Claude enforces hard-stop logic per D-13/D-14/D-15 |

---

## Standard Stack

This is not a traditional application with npm packages. The "stack" is the set of MCP tools already available in the Claude Code environment.

### Confirmed MCP Tools (VERIFIED: `~/.claude/settings.local.json` permissions allowlist)

| Tool | MCP Server | Purpose |
|------|-----------|---------|
| `mcp__claude_ai_HubSpot__search_crm_objects` | HubSpot | Search companies by name or property filter |
| `mcp__claude_ai_HubSpot__get_crm_objects` | HubSpot | Fetch a specific company record by ID |
| `mcp__claude_ai_HubSpot__search_properties` | HubSpot | Discover available custom properties |
| `mcp__claude_ai_HubSpot__get_properties` | HubSpot | Get property definitions |
| `mcp__claude_ai_PostHog__query-run` | PostHog | Execute HogQL queries against Archive's PostHog project |
| `mcp__claude_ai_PostHog__event-definitions-list` | PostHog | List available event types |
| `mcp__claude_ai_PostHog__properties-list` | PostHog | List available event/person properties |
| `mcp__claude_ai_Stripe__list_subscriptions` | Stripe | List subscriptions (filterable) |
| `mcp__claude_ai_Stripe__search_stripe_resources` | Stripe | Search Stripe objects (customers, subscriptions, products) |
| `mcp__claude_ai_Stripe__fetch_stripe_resources` | Stripe | Fetch a specific Stripe resource by ID |
| `mcp__claude_ai_Stripe__list_invoices` | Stripe | List invoices for billing history |

**Stripe MCP status:** CONFIRMED AVAILABLE [VERIFIED: settings.local.json] — 4 Stripe tools are in the permissions allowlist. This resolves the blocker noted in STATE.md.

### Skill File Format

A Claude Code skill is a markdown file placed at:
- Personal (all projects): `~/.claude/commands/<name>.md` (legacy format, still works)
- Personal (new format): `~/.claude/skills/<name>/SKILL.md`
- Project-local: `.claude/commands/<name>.md` or `.claude/skills/<name>/SKILL.md`

[VERIFIED: Official Claude Code docs — code.claude.com/docs/en/slash-commands]

The `/scale` skill should be created at `~/.claude/commands/scale.md` — this matches the pattern used by existing skills (`/qbr-deck`, `/daily-brief`, `/stumble-grader`) in this environment.

---

## Architecture Patterns

### System Architecture Diagram

```
CSM types: /scale acme corp
         OR /scale shop_12345
                |
                v
    +---------------------------+
    |   STEP 1: IDENTITY        |
    |   HubSpot name search     |
    |   OR shop_id lookup       |
    +---------------------------+
                |
        [0 matches] --> ERROR: "No company found for 'acme corp'"
        [1 match]   --> STEP 1b: Confirm (if shop ID input)
                        OR proceed directly (if name + 1 result)
        [2-5 matches] -> DISAMBIGUATION: numbered list, CSM picks 1
        [>5 matches] --> "Too many matches. Re-run with shop ID."
                |
                v
    +---------------------------+
    |   STEP 1b: CONFIRM        |
    |   Show: Company Name      |
    |   Ask: "Is this correct?" |
    +---------------------------+
                |
                v
    +---------------------------+
    |   STEP 2: WORKSPACE SCOPE |
    |   Extract shop_id(s) from |
    |   HubSpot company record  |
    |   Ask: "Other workspaces?"|
    +---------------------------+
                |
                v
    +---------------------+  +------------------+
    |   PostHog (parallel)|  |  Stripe (parallel)|
    |   UGC events/month  |  |  Subscription     |
    |   (last 3 months)   |  |  Product/Price    |
    |   Active seat count |  |  UGC limit        |
    +---------------------+  +------------------+
                \                   /
                 v                 v
    +----------------------------------+
    |   VALIDATION + CALCULATION       |
    |   - Check critical fields        |
    |   - Calculate 3-mo rolling avg   |
    |   - Calculate trend direction    |
    |   - Count workspaces             |
    +----------------------------------+
                |
                v
    +----------------------------------+
    |   OUTPUT: Structured text        |
    |   Company | Plan | Price         |
    |   UGC avg/limit | Seats          |
    |   Workspaces | Trend             |
    +----------------------------------+
```

### Recommended Skill File Structure

```
~/.claude/commands/
└── scale.md           # Single file, all instructions inline
                       # (same pattern as qbr-deck.md, daily-brief.md)
```

No supporting files needed for Phase 1. If the skill grows complex in Phase 2+, migrate to `~/.claude/skills/scale/SKILL.md` with a supporting `pricing-reference.md`.

### Pattern 1: Skill File Skeleton

**What:** A Claude Code command file with a description header, `$ARGUMENTS` capture, and step-by-step execution instructions.

**When to use:** All Claude Code custom commands.

```markdown
# Scale Renewal Tool

Resolve customer identity and return a validated data profile for renewal planning.

## Input

The user will provide: `$ARGUMENTS`

Parse the argument as either:
- A **company name** (any string not matching shop ID format) → search HubSpot by name
- A **shop ID** (numeric string, e.g., "12345" or "shop_12345") → look up HubSpot by shop_id property

If no argument is provided, ask: "Please provide a company name or shop ID to look up."

## Execution Steps

### Step 1: Identity Resolution (HubSpot)
...

### Step 2: Workspace Scope
...

### Step 3: Parallel Data Fetch
...

### Step 4: Validation
...

### Step 5: Output
...
```

[CITED: ~/.claude/commands/qbr-deck.md — established pattern for this environment]

### Pattern 2: HubSpot Company Search

**What:** Use `search_crm_objects` to find companies by name or custom property.

**When to use:** IDENT-01 (name search) and IDENT-02 (shop ID lookup).

```
# Name search:
mcp__claude_ai_HubSpot__search_crm_objects
  objectType: "companies"
  query: "<name from $ARGUMENTS>"
  properties: ["name", "shop_id", "customer_tier", "lifecyclestage"]

# shop_id lookup:
mcp__claude_ai_HubSpot__search_crm_objects
  objectType: "companies"
  filterGroups: [{ filters: [{ propertyName: "shop_id", operator: "EQ", value: "<shop_id>" }] }]
  properties: ["name", "shop_id", "customer_tier", "lifecyclestage", "arr__active_deals_"]
```

[VERIFIED: ~/.claude/commands/qbr-deck.md shows `mcp__claude_ai_HubSpot__search_crm_objects` with `objectType` and property selection]
[VERIFIED: ~/.claude/projects/-Users-aaronrampersad/memory/account-health-review-skill.md confirms filter pattern]

### Pattern 3: Interactive Disambiguation

**What:** Skill instructs Claude to present numbered options and pause for CSM input.

**When to use:** When multiple HubSpot companies match a name search (IDENT-04).

```markdown
## Disambiguation Protocol

If HubSpot returns 2-5 company matches, present them as a numbered list:

```
Found multiple companies matching "[name]":
1. Acme Corp — shop_id: 12345 — Plan: Growth — Tier: 2
2. Acme Holdings — shop_id: 67890 — Plan: Startup — Tier: 3
...
Which company do you want? Enter a number (or type a shop ID to search again).
```

Wait for the CSM's response, then proceed with the selected company.

If HubSpot returns >5 matches, do NOT show a list. Instead respond:
"Too many matches for '[name]'. Please re-run with a shop ID: /scale <shop_id>"
```

**Key insight:** Claude Code skills do not need any special mechanism for user interaction. The skill instructs Claude to ask a question, and Claude naturally pauses for the user response before continuing. This is a standard multi-turn conversation.

[VERIFIED: Official Claude Code skill docs confirm skills run inline in the conversation; the `context: fork` subagent approach is NOT needed here since we want interactive back-and-forth]

### Pattern 4: PostHog HogQL for UGC Usage

**What:** Use `mcp__claude_ai_PostHog__query-run` to execute HogQL queries for UGC events.

**When to use:** DATA-01 (3-month rolling average), DATA-04 (active seats), DATA-06 (trend).

PostHog project: **192859** [VERIFIED: posthog-api-access.md]
UGC event: **`crm.shop_item.created`** [VERIFIED: qbr-deck.md uses this event for "UGC Pieces Collected"]
shop_id key: **`properties.shop_id`** [VERIFIED: posthog-event-matrix.md — "All events are filterable by shop_id"]
Active users proxy: **`$pageview` with `COUNT(DISTINCT person_id)`** [VERIFIED: churn-risk-alert-framework.md — `auth.user.logged_in` is too new (started March 24, 2026); use $pageview as the proxy]

```sql
-- UGC count by month for last 3 months (for one shop_id)
SELECT
  toStartOfMonth(timestamp) AS month,
  COUNT(*) AS ugc_count
FROM events
WHERE event = 'crm.shop_item.created'
  AND properties.shop_id = '{shop_id}'
  AND timestamp >= now() - INTERVAL 3 MONTH
GROUP BY month
ORDER BY month ASC
LIMIT 10

-- For multiple shop_ids (multi-workspace), use IN:
WHERE properties.shop_id IN ('{id1}', '{id2}', '{id3}')
```

```sql
-- Active seats: distinct users in last 90 days
SELECT COUNT(DISTINCT person_id) AS active_seats
FROM events
WHERE event = '$pageview'
  AND properties.shop_id IN ('{id1}', '{id2}')
  AND timestamp >= now() - INTERVAL 90 DAY
```

**Critical note:** Do NOT use `filterTestAccounts: true` in HogQL — this returns empty results. [VERIFIED: churn-risk-alert-framework.md]

**Default LIMIT:** PostHog HogQL defaults to 100 rows. Add `LIMIT 10000` for any query that could return many rows. For monthly aggregation with 3 months, LIMIT 10 is sufficient.

### Pattern 5: Stripe Data Fetch

**What:** Use Stripe MCP tools to retrieve subscription, product, and price data.

**When to use:** DATA-02 (UGC limit), DATA-03 (plan name and pricing).

```
# Search for customer's subscription by metadata (shop_id is likely in metadata):
mcp__claude_ai_Stripe__search_stripe_resources
  resource: "subscriptions"
  query: "metadata['shop_id']:'12345'"

# Or search by customer ID (if HubSpot has stripe_customer_id):
mcp__claude_ai_Stripe__list_subscriptions
  customer: "<stripe_customer_id>"

# Fetch subscription details (product + price):
mcp__claude_ai_Stripe__fetch_stripe_resources
  resource: "subscriptions/<sub_id>"

# Then fetch the price/product for plan name and pricing:
mcp__claude_ai_Stripe__fetch_stripe_resources
  resource: "prices/<price_id>"

mcp__claude_ai_Stripe__fetch_stripe_resources
  resource: "products/<product_id>"
```

[VERIFIED: All 4 Stripe tools confirmed in settings.local.json allowlist]
[ASSUMED: Stripe subscription metadata contains `shop_id` — must verify during execution by inspecting a real subscription]
[ASSUMED: UGC limit is stored in Stripe subscription metadata or product metadata — D-05 decided Stripe is source of truth but exact field name is unknown]

### Pattern 6: Trend Calculation (Claude logic, no tool call)

**What:** Once PostHog returns monthly UGC counts, Claude calculates trend per D-12.

**When to use:** DATA-06.

```markdown
## Trend Calculation

Given UGC counts for the last 3 calendar months [month1, month2, month3] (oldest to newest):

- Compare month1 → month2 and month2 → month3
- If 2 of 2 comparisons are increasing: trend = "growing"
- If 2 of 2 comparisons are decreasing: trend = "declining"
- Otherwise: trend = "stable"

Show trend alongside the 3-month rolling average:
- Rolling avg = (month1 + month2 + month3) / 3
```

### Anti-Patterns to Avoid

- **Putting disambiguation in a subagent (context: fork):** Forked subagents lose access to the conversation history and cannot do interactive multi-turn flows. Keep `/scale` inline. [VERIFIED: Claude Code docs state `context: fork` skills "won't have access to your conversation history"]
- **Using `filterTestAccounts: true` in PostHog:** Returns empty results in this Archive PostHog project. Always use `false` or omit it. [VERIFIED: churn-risk-alert-framework.md]
- **Assuming `shop_id` is always a single value in HubSpot:** The field may contain multiple IDs (D-10). The skill must handle both cases — extract all values, then ask CSM if others should be included.
- **Using `auth.user.logged_in` for active seat counting:** This event only started March 24, 2026 — too new for meaningful historical data. Use `$pageview` as the login/activity proxy. [VERIFIED: churn-risk-alert-framework.md]
- **Hardcoding the Stripe lookup to just `metadata['shop_id']`:** HubSpot company records may also have a `stripe_customer_id` field — the skill should try both approaches and gracefully handle either.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HubSpot company search | Custom API calls with fetch/curl | `mcp__claude_ai_HubSpot__search_crm_objects` | MCP tool handles auth, rate limiting, pagination |
| PostHog HogQL queries | Bash curl to PostHog API | `mcp__claude_ai_PostHog__query-run` | MCP tool is pre-authenticated to project 192859 |
| Stripe subscription lookup | Direct Stripe API calls | `mcp__claude_ai_Stripe__search_stripe_resources` | MCP tool handles auth |
| Interactive prompting | Complex stdin/state machines | Claude conversation flow | Skills are prompts — Claude naturally pauses and waits for user input |
| Progress display | Terminal animation or status loops | Inline text in skill instructions | Claude narrates each step in plain text per D-16 |

**Key insight:** This skill contains zero application code. It is entirely prompt instructions that direct Claude to use pre-built MCP tools. The "implementation" is writing clear, unambiguous instructions that Claude can follow reliably.

---

## Common Pitfalls

### Pitfall 1: shop_id Multi-Value Format Unknown
**What goes wrong:** The skill attempts to use `shop_id` as a single value but the HubSpot field actually contains multiple IDs with a delimiter (comma, semicolon, newline). The first ID works; subsequent shop IDs for multi-workspace customers are silently dropped.
**Why it happens:** D-10 explicitly notes "Format TBD — must check HubSpot to confirm."
**How to avoid:** During Plan 01-01 execution, immediately run `search_properties` or `get_properties` on the HubSpot companies objectType to inspect the `shop_id` field type and format. Then test against a known multi-workspace customer (e.g., search "L'Oreal" — should have Garnier, Maybelline, etc.).
**Warning signs:** L'Oreal or agency accounts show only 1 workspace when CSM knows there should be multiple.

### Pitfall 2: Stripe Lookup Key Unknown
**What goes wrong:** The skill cannot find a customer's Stripe subscription because the linking field between HubSpot and Stripe is unconfirmed.
**Why it happens:** HubSpot companies may have a `stripe_customer_id` field, OR Stripe subscriptions may have `shop_id` in metadata, OR both. Neither is confirmed.
**How to avoid:** During Plan 01-02 execution, inspect a known customer's HubSpot record to see if `stripe_customer_id` is populated. If not, search Stripe by name or metadata. Document the working lookup path for the skill prompt.
**Warning signs:** Stripe fetch returns no subscription for a known paying customer.

### Pitfall 3: UGC Limit Location in Stripe Unknown
**What goes wrong:** D-05 says UGC limit comes from Stripe, but the exact field location (subscription metadata, product metadata, price metadata) is not confirmed. The skill may look in the wrong place and silently get null.
**Why it happens:** This is an Archive-specific business data field, not a standard Stripe concept.
**How to avoid:** During execution, fetch a live subscription and inspect the full JSON response — check `metadata`, `items.data[0].price.metadata`, `items.data[0].price.product.metadata` for any field resembling "ugc_limit", "ugc_cap", "credit_limit", etc.
**Warning signs:** D-13 hard-stop triggers for UGC limit on every customer.

### Pitfall 4: PostHog Returns No Data for Old Customers
**What goes wrong:** Customers who use Archive but don't trigger `crm.shop_item.created` events (e.g., they use the platform but haven't created new UGC items) return zero UGC usage. The skill incorrectly interprets this as missing data and triggers a hard-stop.
**Why it happens:** `crm.shop_item.created` only fires when new UGC is ingested. A customer with a static library would show 0.
**How to avoid:** Distinguish between "no events found" (possibly valid — low-activity customer) and "API call failed" (connection error). Only trigger D-15 fail-fast for API errors. For zero UGC, surface it as a data point with a note: "0 UGC created in past 3 months — verify customer is active."
**Warning signs:** Too many customers triggering hard-stops for UGC data.

### Pitfall 5: Skill Scope Creep into Phase 2 Work
**What goes wrong:** The skill prompt starts calculating pricing options or generating renewal recommendations while still in the data fetch phase.
**Why it happens:** Claude naturally wants to be helpful and may continue beyond the data collection step.
**How to avoid:** End the Phase 1 skill output with a clear termination statement: "Data collection complete. Run `/scale-price` to generate renewal options (Phase 2)." Or structure the Phase 1 output to explicitly say what is and isn't included.
**Warning signs:** The skill output contains pricing recommendations before Phase 2 is built.

### Pitfall 6: $ARGUMENTS Parsing Ambiguity
**What goes wrong:** The skill cannot determine if "12345" is a company name or a shop ID. Or "acme corp 2024" is misidentified as a shop ID.
**Why it happens:** No strict format enforced for `/scale` arguments per D-18.
**How to avoid:** Define a clear detection rule: if `$ARGUMENTS` is purely numeric (or matches `shop_NNN` pattern), treat as shop ID. Otherwise, treat as company name. Make this rule explicit in the skill prompt.
**Warning signs:** Numeric company names (rare but possible) get misrouted.

---

## Code Examples

Verified patterns from existing skills in this environment:

### HubSpot Company Search (from qbr-deck.md)
```
Use `mcp__claude_ai_HubSpot__search_crm_objects` to find the company by name. Pull:
- name
- shop_id
- customer_tier
- arr__active_deals_
```
[CITED: ~/.claude/commands/qbr-deck.md]

### HubSpot Field Names (VERIFIED)
| Field | HubSpot Property Name | Source |
|-------|----------------------|--------|
| Shop ID | `shop_id` | [VERIFIED: cs-health-dashboard.md, account-health-review-skill.md] |
| Customer Tier | `customer_tier` | [VERIFIED: cs-health-dashboard.md] |
| CSM Owner | `success_company_owner` | [VERIFIED: cs-health-dashboard.md] |
| Lifecycle Stage | `lifecyclestage` | [VERIFIED: cs-health-dashboard.md] |
| ARR | `arr__active_deals_` | [VERIFIED: cs-health-dashboard.md] |
| Subscription Period Start | `subscription_current_period_start` | [VERIFIED: account-health-review-skill.md — sourced from Hyperline] |
| Stripe Customer ID | ASSUMED — likely `stripe_customer_id` | [ASSUMED: common HubSpot-Stripe integration field name; verify during execution] |

### PostHog UGC Query (from qbr-deck.md)
```sql
-- UGC Collected (current quarter pattern — adapt to monthly grouping for rolling avg):
COUNT(*) FROM events
WHERE event = 'crm.shop_item.created'
  AND properties.shop_id = '{shop_id}'
  AND timestamp >= '{period_start}'
  AND timestamp < '{period_end}'
```
[CITED: ~/.claude/commands/qbr-deck.md — qbr-deck uses this exact event for UGC counting]

### PostHog Active Users Pattern (from churn-risk-alert-framework.md)
```sql
-- Active user count (use $pageview as proxy, not auth.user.logged_in):
COUNT(DISTINCT person_id) AS active_seats
FROM events
WHERE event = '$pageview'
  AND properties.shop_id = '{shop_id}'
  AND timestamp >= now() - INTERVAL 90 DAY
```
[CITED: ~/.claude/projects/-Users-aaronrampersad/memory/churn-risk-alert-framework.md]

### PostHog Last Login Pattern (from account-health-review-skill.md)
```sql
SELECT properties.shop_id AS shop_id, max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL 90 DAY
  AND properties.shop_id IN ('{id1}', '{id2}')
  AND isNotNull(properties.shop_id)
GROUP BY shop_id
ORDER BY last_seen DESC
LIMIT 100
```
[CITED: ~/.claude/projects/-Users-aaronrampersad/memory/account-health-review-skill.md]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` file | `.claude/skills/<name>/SKILL.md` (new format) | Recent (Claude Code docs) | Old format still works; new format supports supporting files and `disable-model-invocation`. For Phase 1, either works — use `~/.claude/commands/scale.md` to match existing skills in environment. |
| Separate skill files per step | Single skill file with sequential steps | N/A for this project | Multi-step orchestration is done with numbered steps inside one skill file, as seen in qbr-deck.md |

**Deprecated/outdated:**
- `auth.user.logged_in` for active user counting: Only started March 24, 2026 — not enough history. Use `$pageview` as proxy until this event has 28+ days of data.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stripe subscription metadata contains `shop_id` as a searchable key | Architecture Patterns — Pattern 5 | Skill cannot link HubSpot company to Stripe subscription; need alternative lookup (by customer name or HubSpot `stripe_customer_id` field) |
| A2 | UGC limit is stored somewhere in Stripe's subscription or product metadata | Architecture Patterns — Pattern 5 | D-05 says Stripe is source of truth for UGC limit but the exact field name is unknown; if it's not in Stripe, must fall back to a HubSpot custom property |
| A3 | HubSpot companies have a `stripe_customer_id` custom property | Code Examples — HubSpot Field Names | Alternative Stripe lookup path unavailable; skill must search Stripe by company name or metadata only |
| A4 | `crm.shop_item.created` is the correct UGC ingestion event | Architecture Patterns — Pattern 4 | UGC usage data would be incorrect; must cross-reference with Archive's actual billing/usage definition of "UGC" |
| A5 | HubSpot `shop_id` field delimiter for multi-value entries | Common Pitfalls — Pitfall 1 | Multi-workspace customers (L'Oreal, agencies) would have incomplete data |

---

## Open Questions

1. **What delimiter does HubSpot use for multiple shop IDs in the `shop_id` field?**
   - What we know: The field can contain multiple IDs (D-10). The CS health dashboard treats `shop_id` as a single value (single join key). The account health skill notes duplicate company records per brand.
   - What's unclear: Is it comma-separated? Semicolon? Or does each brand have a separate HubSpot company record (no multi-value field at all)?
   - Recommendation: During Plan 01-01 execution, search for L'Oreal in HubSpot and inspect the raw `shop_id` field value. This is a 1-minute discovery step.

2. **How does Stripe link to Archive customers — by shop_id in metadata or by Stripe customer ID in HubSpot?**
   - What we know: HubSpot has `subscription_current_period_start` from Hyperline (a billing system). Stripe MCP tools are available. The cs-health-dashboard bypassed Stripe gracefully.
   - What's unclear: Whether `stripe_customer_id` is a populated HubSpot property, or whether Stripe subscriptions have Archive's `shop_id` in their metadata.
   - Recommendation: During Plan 01-02, inspect one live HubSpot company record and one Stripe subscription to find the linking field. Document for use in the skill.

3. **What is the exact Stripe field containing UGC limit?**
   - What we know: D-05 says Stripe is the source of truth. The pricing.subscription.created PostHog event fires when subscriptions change.
   - What's unclear: Is UGC limit in subscription metadata? Price metadata? Product metadata? A separate Stripe product feature?
   - Recommendation: Inspect a live Stripe subscription with `fetch_stripe_resources` during Plan 01-02 and search the JSON for any field with "ugc", "limit", "cap", "credit" in the key name.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| HubSpot MCP | IDENT-01, IDENT-02, IDENT-03 | confirmed | Unknown (MCP) | None — blocking |
| Stripe MCP | DATA-02, DATA-03 | confirmed | Unknown (MCP) | HubSpot custom property for plan/price if Stripe MCP fails at runtime |
| PostHog MCP | DATA-01, DATA-04, DATA-06 | confirmed | Unknown (MCP) | None — blocking |
| Claude Code (user environment) | All | confirmed | Active installation | N/A |

**All dependencies confirmed available** — the four MCP tools (HubSpot, Stripe, PostHog) are in the permissions allowlist (`~/.claude/settings.local.json`). No blocking dependencies.

---

## Sources

### Primary (HIGH confidence)
- `~/.claude/settings.local.json` — confirmed MCP tool names for HubSpot (4 tools), Stripe (4 tools), PostHog (4 tools)
- `~/.claude/commands/qbr-deck.md` — established skill file pattern, HubSpot search syntax, PostHog query pattern with `crm.shop_item.created`
- `~/.claude/projects/-Users-aaronrampersad/memory/cs-health-dashboard.md` — confirmed HubSpot field names: `shop_id`, `customer_tier`, `success_company_owner`, `lifecyclestage`, `arr__active_deals_`
- `~/.claude/projects/-Users-aaronrampersad/memory/account-health-review-skill.md` — confirmed HubSpot filter patterns, PostHog HogQL last-login query, shop_id lookup approach
- `~/.claude/projects/-Users-aaronrampersad/memory/churn-risk-alert-framework.md` — confirmed PostHog active user proxy ($pageview vs auth.user.logged_in), filterTestAccounts=false requirement, PostHog project 192859
- `~/.claude/projects/-Users-aaronrampersad/memory/posthog-event-matrix.md` — complete Archive PostHog event catalog; confirms `crm.shop_item.created` event and `shop_id` as universal filter key
- `~/.claude/projects/-Users-aaronrampersad/memory/posthog-api-access.md` — confirmed PostHog project ID 192859
- Official Claude Code skill documentation (code.claude.com/docs/en/slash-commands) — confirmed skill file format, $ARGUMENTS, interactive flow, context: fork limitations

### Secondary (MEDIUM confidence)
- `~/.claude/commands/daily-brief.md` — confirms MCP tool invocation syntax pattern (`mcp__claude_ai_X__tool_name`)
- `~/.claude/projects/-Users-aaronrampersad/memory/account-health-review-skill.md` — Stripe customer ID field name on HubSpot (assumed field name from integration pattern)

### Tertiary (LOW confidence / ASSUMED)
- Stripe metadata structure for shop_id and UGC limit — not verified; must be confirmed during execution
- HubSpot `stripe_customer_id` property existence — inferred from common HubSpot-Stripe integration patterns, not confirmed in this environment

---

## Metadata

**Confidence breakdown:**
- MCP tool availability: HIGH — all tools confirmed in permissions allowlist
- HubSpot field names: HIGH — confirmed in cs-health-dashboard.md (live project using same fields)
- PostHog queries: HIGH — patterns verified against churn-risk-alert-framework.md and qbr-deck.md (working production skills)
- Stripe data structure: LOW — tools confirmed available but exact field locations for plan/price/UGC limit are unconfirmed
- Skill file format: HIGH — verified against official docs and 3 working skills in this environment
- Interactive disambiguation flow: HIGH — confirmed by official docs that skills run inline in conversation

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable APIs; Stripe structure may need re-check if Archive changes billing schema)
