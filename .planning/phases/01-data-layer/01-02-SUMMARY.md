---
phase: 01-data-layer
plan: 02
subsystem: skill
tags: [posthog, stripe, mcp, data-fetch, validation, claude-code-skill]

# Dependency graph
requires:
  - "01-01: /scale skill file with identity resolution steps"
provides:
  - "Complete /scale data fetch: PostHog UGC usage, active seats, Stripe plan/pricing/UGC limit"
  - "Validation layer with hard-stop on critical fields and warn-continue on secondary"
  - "Structured CUSTOMER DATA PROFILE output for CSM terminal use"
affects: [02-pricing-engine]

# Tech tracking
tech-stack:
  added: []
  patterns: [posthog-hogql-monthly-aggregation, stripe-cascading-lookup, mcp-parallel-data-fetch, trend-calculation]

key-files:
  created: []
  modified:
    - "~/.claude/commands/scale.md"
    - ".claude/commands/scale.md"

key-decisions:
  - "Stripe lookup uses 3-level cascade: stripe_customer_id from HubSpot -> metadata search -> name search"
  - "UGC limit treated as secondary field (warn, not hard-stop) since exact Stripe field location is unknown"
  - "Trend calculated as Growing/Stable/Declining using sequential month-over-month comparison"
  - "$pageview used for active seats instead of auth.user.logged_in (too new, started March 24 2026)"

patterns-established:
  - "PostHog HogQL monthly aggregation with toStartOfMonth and IN clause for multi-workspace"
  - "Stripe cascading lookup pattern: customer ID -> metadata -> name search"
  - "Validation split: critical fields (hard-stop) vs secondary fields (warn-continue)"
  - "Progress narration pattern: tell user what is happening before and after each fetch"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-06]

# Metrics
duration: 12min
completed: 2026-04-27
---

# Phase 1 Plan 02: Data Fetch, Validation, and Output Summary

**Complete /scale data layer with PostHog UGC/seats queries, Stripe cascading billing lookup, validation with hard-stop/warn logic, and structured CUSTOMER DATA PROFILE output**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-27T18:00:49Z
- **Completed:** 2026-04-27T18:13:42Z
- **Tasks:** 1 of 2 (paused at checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments

- Added Step 3 (Parallel Data Fetch) with three sub-steps:
  - 3A: PostHog UGC usage query with 3-month rolling average and Growing/Stable/Declining trend
  - 3B: PostHog active seats via $pageview COUNT(DISTINCT person_id) over 90 days
  - 3C: Stripe cascading lookup (stripe_customer_id -> metadata search -> name search) for plan, pricing, and UGC limit
- Added Step 4 (Validation) with D-13/D-14/D-15 enforcement:
  - Hard-stop on plan name, current price, UGC usage (query errors only)
  - Warn-and-continue on active seats, UGC limit, workspace count
  - Immediate stop on API failures with system name in error message
- Added Step 5 (Output) with structured CUSTOMER DATA PROFILE template
- Removed placeholder comment from Plan 01-01
- Copied updated file to ~/.claude/commands/scale.md for live use

## Task Commits

Each task was committed atomically:

1. **Task 1: Add data fetch, validation, and output steps** - `080b445` (feat)

**Plan metadata:** pending (checkpoint not yet resolved)

## Files Created/Modified

- `.claude/commands/scale.md` - Updated with Steps 3-5 (repo-tracked copy)
- `~/.claude/commands/scale.md` - Updated live skill file (personal path)

## Decisions Made

- Stripe lookup uses a 3-level cascade because the linking field between HubSpot and Stripe is unconfirmed -- the skill tries all three approaches and uses whichever works
- UGC limit classified as secondary (warn, not hard-stop) per D-13 exception for first-time discovery -- the exact Stripe metadata field name is unknown
- Zero UGC events treated as valid data (low-activity customer), not missing data -- only PostHog query errors trigger hard-stop
- $pageview chosen over auth.user.logged_in for active seats because the login event only started March 24, 2026

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all Steps 3-5 are fully implemented with complete MCP tool call instructions, validation logic, and output template.

## Checkpoint Status

**Task 2 (checkpoint:human-verify) is BLOCKING.** The CSM must verify the complete /scale flow against a live customer to confirm:
1. Identity resolution works (from Plan 01-01)
2. PostHog UGC and seat data returns correctly
3. Stripe subscription is found via one of the three lookup approaches
4. Plan name, pricing, and UGC limit are extracted
5. Output matches the structured template

## Self-Check: PASSED

- [x] `.claude/commands/scale.md` exists and contains Steps 3-5
- [x] Commit `080b445` exists in git log
- [x] All 16 acceptance criteria verified passing
- [x] No file deletions in commit

---
*Phase: 01-data-layer*
*Completed: 2026-04-27 (Task 1 only; checkpoint pending)*
