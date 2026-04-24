# Phase 1: Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 01-data-layer
**Areas discussed:** Identity resolution, Data source mapping, Missing data handling, Skill UX & output

---

## Identity Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered list + pick | Show all matches with key details, ask CSM to pick | ✓ |
| Auto-pick closest + confirm | Auto-select best match, ask "Is this right?" | |
| Show all, abort if ambiguous | Show matches but refuse to proceed until shop ID | |

**User's choice:** Numbered list + pick
**Notes:** Max 5 matches shown. If >5, ask CSM to use shop ID.

| Option | Description | Selected |
|--------|-------------|----------|
| Always confirm | Show company name, ask "Is this right?" before proceeding | ✓ |
| Skip confirmation | Trust shop ID and go straight to data fetch | |
| Confirm only if name looks off | Auto-proceed but flag suspicious names | |

**User's choice:** Always confirm for shop ID lookups

| Option | Description | Selected |
|--------|-------------|----------|
| HubSpot only | Search HubSpot by name, cross-reference via shop ID | ✓ |
| HubSpot + Stripe in parallel | Search both simultaneously | |
| HubSpot then Stripe fallback | Try HubSpot first, fall back to Stripe | |

**User's choice:** HubSpot only

| Option | Description | Selected |
|--------|-------------|----------|
| 5 matches max | Ask for shop ID if more than 5 match | ✓ |
| 10 matches max | More generous display limit | |
| No limit, show all | Show every match | |

**User's choice:** 5 matches max

---

## Data Source Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Stripe (billing system) | Pull UGC limit from Stripe subscription | ✓ |
| HubSpot (custom property) | Pull from HubSpot company property | |
| Not sure yet | TBD | |

**User's choice:** Stripe — billing system is source of truth

**User clarification (workspaces):** 1 workspace = 1 shop ID. Single customer can have multiple shop IDs. Examples: L'Oreal (Garnier, Maybelline), agencies with multiple client brands. Most single-brand customers are 1:1. Shop ID field on HubSpot can contain multiple IDs. Some customers also have separate HubSpot company records per brand.

| Option | Description | Selected |
|--------|-------------|----------|
| Just the selected company | Work with shop IDs in the selected record | |
| Auto-discover related companies | Find all linked HubSpot companies | |
| Ask the CSM | Ask if there are additional workspaces to include | ✓ |

**User's choice:** Ask the CSM — after extracting shop IDs from selected record, ask if there are more

| Option | Description | Selected |
|--------|-------------|----------|
| Comma-separated | e.g., "shop_123, shop_456" | |
| Semicolon-separated | e.g., "shop_123;shop_456" | |
| Not sure | Need to check HubSpot | ✓ |

**User's choice:** Not sure — TBD, must check HubSpot

| Option | Description | Selected |
|--------|-------------|----------|
| PostHog | Count distinct users with activity | ✓ |
| HubSpot property | Field on company record | |
| Stripe subscription | Part of per-seat billing | |
| Not sure | TBD | |

**User's choice:** PostHog

| Option | Description | Selected |
|--------|-------------|----------|
| Month-over-month direction | Compare 3 months sequentially, 2/3 = direction | ✓ |
| Latest vs 3-month average | Current month vs average, >10% threshold | |
| You decide | Claude picks | |

**User's choice:** Month-over-month direction

---

## Missing Data Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-stop on critical fields | Plan, price, UGC usage are must-haves; secondary fields warn | ✓ |
| Always hard-stop | Any missing field = full stop | |
| Always warn and continue | Show warnings, produce whatever is available | |

**User's choice:** Hard-stop on critical fields (plan name, current price, UGC usage). Secondary fields (seats, workspaces) warn and continue.

| Option | Description | Selected |
|--------|-------------|----------|
| Field name + where to fix it | e.g., "Missing: UGC limit — check Stripe for shop_12345" | ✓ |
| Simple field name only | e.g., "Missing: UGC limit" | |
| You decide | Claude picks | |

**User's choice:** Field name + where to fix it — actionable errors

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast with clear message | Stop and name which system is unreachable | ✓ |
| Retry once, then fail | One automatic retry per API call | |
| Fetch what you can | Return partial data with warning | |

**User's choice:** Fail fast — no silent retries, CSM can re-run

---

## Skill UX & Output

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step updates | Show each fetch step as it happens | ✓ |
| Single loading message | One message, then full result | |
| You decide | Claude picks | |

**User's choice:** Step-by-step progress updates

| Option | Description | Selected |
|--------|-------------|----------|
| Structured text summary | Clean text block with all fields | ✓ |
| JSON-like data dump | Raw data object | |
| Skip standalone output | No visible output until Phase 2 | |

**User's choice:** Structured text summary — readable in terminal

| Option | Description | Selected |
|--------|-------------|----------|
| No flags for v1 | Just /scale [name or shop ID] | ✓ |
| Add --no-confirm flag | Skip identity confirmation | |
| Add --refresh flag | Force re-fetch | |

**User's choice:** No flags for v1 — keep it simple

---

## Claude's Discretion

- PostHog query structure for UGC aggregation and distinct user counting
- Internal data object shape for Phase 2 consumption
- Progress update formatting and timing

## Deferred Ideas

None — discussion stayed within phase scope
