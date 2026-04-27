---
phase: 01-data-layer
verified: 2026-04-27T21:36:19Z
status: human_needed
score: 8/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run /scale with a known company name (e.g., L'Oreal) and verify disambiguation list appears with name, shop_id, tier"
    expected: "Numbered list of 2-5 matches. Selecting one proceeds to workspace scope."
    why_human: "Requires live HubSpot MCP connection and interactive conversation flow"
  - test: "Run /scale with a known shop ID and verify confirmation prompt appears"
    expected: "Shows company name and asks 'Is this correct?' before proceeding"
    why_human: "Requires live HubSpot MCP connection"
  - test: "Complete a full /scale run through to CUSTOMER DATA PROFILE output"
    expected: "Structured output with Company, Plan, Monthly/Annual Price, UGC Used/Total, Utilization %, Active Seats, Workspaces, Warnings"
    why_human: "Requires live PostHog + Stripe + HubSpot MCP connections simultaneously"
  - test: "Run /scale for a company with no Stripe subscription"
    expected: "Hard-stop error: MISSING Plan name with actionable Stripe check instructions"
    why_human: "Requires live Stripe MCP to confirm error handling path"
  - test: "Verify UGC data accuracy -- compare pricing_ugc_used/total from PostHog groups table against known billing data"
    expected: "Values match what Dorothy's N8N workflow or admin dashboard shows"
    why_human: "Requires domain knowledge of actual customer billing data"
gaps:
  - truth: "Usage trend direction (growing, stable, declining) is shown alongside the 3-month average"
    status: failed
    reason: "UGC data source was switched from events table (monthly breakdown) to groups table (current billing period snapshot). The groups table does not provide historical monthly data needed for trend calculation. The switch was intentional and improves accuracy for UGC counts, but trend direction was dropped entirely with no replacement."
    artifacts:
      - path: ".claude/commands/scale.md"
        issue: "No mention of trend, growing, stable, declining, or month-over-month comparison anywhere in the file. Output template has no Trend field."
    missing:
      - "Trend direction calculation logic (Growing/Stable/Declining per D-12)"
      - "Either: restore monthly UGC query from events table alongside groups query for trend, OR add a groups-table historical approach, OR explicitly descope DATA-06 with override"
  - truth: "Tool pulls UGC usage from PostHog as a 3-month rolling average (DATA-01)"
    status: failed
    reason: "DATA-01 specifies '3-month rolling average' but the implementation shows current billing period usage (pricing_ugc_used / pricing_ugc_total) from the groups table. This is a more accurate data source but does not match the requirement as written. User context confirms this is an intentional deviation."
    artifacts:
      - path: ".claude/commands/scale.md"
        issue: "UGC section header says 'current billing period' not '3-month rolling average'. No monthly aggregation or averaging logic exists."
    missing:
      - "Either: update REQUIREMENTS.md to reflect the new approach (current billing period usage from groups table), OR add override accepting this deviation"
---

# Phase 1: Data Layer Verification Report

**Phase Goal:** CSM can run `/scale [name or shop ID]` and get back a confirmed customer profile with validated usage, plan, and billing data from all three systems
**Verified:** 2026-04-27T21:36:19Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CSM runs `/scale acme` and the tool surfaces all HubSpot matches -- never silently picks one | VERIFIED | Skill has 4-branch result handling (0, 1, 2-5, >5). Explicit instruction: "Do NOT silently pick the first match." Disambiguation numbered list format present (line 58-66). |
| 2 | CSM runs `/scale shop_12345` and the tool resolves company name and confirms before proceeding | VERIFIED | Branch B uses filterGroups with shop_id EQ filter. Shows "Is this correct?" prompt (line 96). Explicit: "Wait for CSM confirmation before proceeding." |
| 3 | After identity confirmed, tool returns UGC usage, UGC limit, plan name, monthly/annual price, active seats, workspace count | VERIFIED (with deviation) | All fields present: UGC from PostHog groups (pricing_ugc_used/total), plan+price from Stripe cascading lookup, seats from PostHog $pageview, workspaces from HubSpot shop_id. **Deviation:** UGC is current billing period, not 3-month rolling avg. This is more accurate per user-confirmed discovery. |
| 4 | When required field (plan, price, UGC usage) is missing, tool stops with explicit error | VERIFIED | Step 4 has hard-stop for plan name, current price, UGC usage with MISSING: prefix and actionable fix instructions. Zero UGC correctly treated as valid. API failure has immediate stop with ERROR: prefix. |
| 5 | Usage trend direction (growing, stable, declining) shown alongside 3-month average | FAILED | No trend calculation exists anywhere in skill file. No Growing/Stable/Declining logic. No month-over-month comparison. No 3-month average. The switch to groups table eliminated the monthly data needed for trend. |
| 6 | CSM runs `/scale acme` and sees numbered list with name, shop ID, and plan (Plan 01 T1) | VERIFIED | Format: "1. [Company Name] -- shop_id: [id] -- Tier: [tier]" (line 60). |
| 7 | CSM runs `/scale 12345` and sees confirmation prompt showing resolved company name (Plan 01 T2) | VERIFIED | "Found: **[Company Name]** (shop_id: [id], Tier: [tier]). Is this correct?" (line 96). |
| 8 | When >5 matches, tool tells CSM to re-run with shop ID (Plan 01 T4) | VERIFIED | "Too many matches for '[name]' ([N] found). Please re-run with a shop ID" (line 71). |
| 9 | After company selection, tool shows all shop IDs and asks about additional workspaces (Plan 01 T5) | VERIFIED | Step 2 extracts shop_id, handles multi-value delimiters, shows "Does this customer have other workspaces we should include?" (line 112). |
| 10 | When critical fields missing, tool stops with actionable error per D-13/D-14 (Plan 02 T6) | VERIFIED | Three hard-stop fields with specific error messages naming the field AND where to fix it. API failure handling with system name. |

**Score:** 8/10 truths verified (truths 5 and the underlying DATA-01 requirement have gaps)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `~/.claude/commands/scale.md` | Live skill file for /scale command | VERIFIED | 343 lines, 12791 bytes. Contains all 5 execution steps. |
| `.claude/commands/scale.md` | Repo-tracked copy | VERIFIED | Identical to live copy (diff shows no differences). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| scale.md | HubSpot MCP | `mcp__claude_ai_HubSpot__search_crm_objects` | WIRED | 2 occurrences: name search (Branch A) and shop_id filter (Branch B). Uses objectType companies, correct properties array. |
| scale.md | PostHog MCP | `mcp__claude_ai_PostHog__query-run` | WIRED | 2 occurrences: groups table query for UGC (Step 3A) and $pageview query for active seats (Step 3B). HogQL format correct. |
| scale.md | Stripe MCP | `mcp__claude_ai_Stripe__*` | WIRED | 6 occurrences: list_subscriptions (2x), search_stripe_resources (2x), fetch_stripe_resources (2x for products and prices). Cascading 3-approach lookup strategy. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| scale.md Step 3A | UGC Used / UGC Total | PostHog groups table (pricing_ugc_used, pricing_ugc_total) | Yes -- queries live PostHog via MCP | FLOWING |
| scale.md Step 3B | Active Seats | PostHog events ($pageview DISTINCT person_id) | Yes -- queries live PostHog via MCP | FLOWING |
| scale.md Step 3C | Plan Name, Price | Stripe subscription + product + price objects | Yes -- queries live Stripe via MCP | FLOWING |
| scale.md Step 1 | Company Name, Tier, Shop ID | HubSpot company search | Yes -- queries live HubSpot via MCP | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (skill is a markdown prompt file, not runnable code -- requires Claude Code interactive session to execute)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IDENT-01 | 01-01 | CSM can trigger /scale with a company name | SATISFIED | Branch A: HubSpot name search with mcp__claude_ai_HubSpot__search_crm_objects |
| IDENT-02 | 01-01 | CSM can trigger /scale with a shop ID | SATISFIED | Branch B: filterGroups with propertyName shop_id, operator EQ |
| IDENT-03 | 01-01 | Tool resolves identity consistently across PostHog, Stripe, HubSpot | SATISFIED | HubSpot is authoritative source, shop_id fans out to PostHog (IN clause) and Stripe (cascading lookup) |
| IDENT-04 | 01-01 | Tool surfaces disambiguation when multiple matches | SATISFIED | 2-5 results: numbered list. >5: redirect to shop ID. Explicit "do NOT silently pick first" |
| DATA-01 | 01-02 | UGC usage from PostHog as 3-month rolling average | BLOCKED | Groups table provides current billing period usage, not 3-month rolling average. Intentional deviation per user but requirement text not updated. |
| DATA-02 | 01-02 | UGC limit from Stripe or HubSpot | SATISFIED | pricing_ugc_total from PostHog groups table (database source of truth). Stripe price nickname noted as cross-reference. |
| DATA-03 | 01-02 | Current plan name and pricing from Stripe | SATISFIED | Product name via fetch_stripe_resources. Price calculated from unit_amount with interval handling (monthly vs annual). |
| DATA-04 | 01-02 | Active seats (active users) | SATISFIED | PostHog COUNT(DISTINCT person_id) on $pageview, 90-day window. Correctly avoids auth.user.logged_in. |
| DATA-05 | 01-01 | Workspaces (shop IDs) | SATISFIED | Step 2 extracts from HubSpot, handles multi-value delimiters, asks CSM about additional workspaces, counts total. |
| DATA-06 | 01-02 | Usage trend direction (growing, stable, declining) | BLOCKED | No trend calculation exists. Groups table lacks monthly historical data needed for D-12 trend logic. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| .claude/commands/scale.md | 23 | HTML comment mentions "forked subagent" | Info | Not a code smell -- this is an anti-pattern WARNING which is correct behavior |
| (none) | - | No TODO/FIXME/PLACEHOLDER found | Info | Clean -- no stub markers |
| (none) | - | No placeholder `<!-- DATA FETCH STEPS -->` | Info | Placeholder was properly replaced with real content |

### Human Verification Required

### 1. Live Identity Resolution Flow

**Test:** Run `/scale L'Oreal` in Claude Code
**Expected:** Multiple HubSpot matches shown as numbered list with name, shop_id, tier. Selecting one proceeds to workspace scope showing extracted shop IDs.
**Why human:** Requires live HubSpot MCP connection and interactive multi-turn conversation

### 2. Shop ID Confirmation Flow

**Test:** Run `/scale [known shop ID]` in Claude Code
**Expected:** Shows resolved company name with "Is this correct?" confirmation before proceeding
**Why human:** Requires live HubSpot MCP connection

### 3. Full End-to-End Data Profile

**Test:** Complete a full `/scale` run for a known customer with active Stripe subscription
**Expected:** CUSTOMER DATA PROFILE output with all fields populated (Company, Plan, Prices, UGC Used/Total, Utilization %, Active Seats, Workspaces)
**Why human:** Requires simultaneous live connections to HubSpot, PostHog, and Stripe MCPs

### 4. Error Handling Path

**Test:** Run `/scale` for a company with no Stripe subscription
**Expected:** Hard-stop with "MISSING: Plan name" error including actionable Stripe check instructions
**Why human:** Requires live Stripe MCP to trigger the error path

### 5. UGC Data Accuracy Check

**Test:** Compare pricing_ugc_used/total values from PostHog groups table against known billing data
**Expected:** Values match what admin dashboard or Dorothy's N8N workflow shows
**Why human:** Requires domain knowledge of actual customer billing data to validate correctness

### Gaps Summary

Two gaps were identified, both stemming from the same root cause: the UGC data source was intentionally switched from PostHog's `events` table (which provided monthly breakdown via `crm.shop_item.created`) to the `groups` table (which provides current billing period snapshot via `pricing_ugc_used`/`pricing_ugc_total`). This switch was necessary because the events table only covers approximately 9 shops, making it unreliable for UGC counts.

**Gap 1: Usage trend direction (SC #5, DATA-06)** -- The groups table provides a point-in-time snapshot, not monthly history. Without monthly data, the Growing/Stable/Declining trend calculation per D-12 cannot be performed. This is the more significant gap because it was a ROADMAP success criterion.

**Gap 2: 3-month rolling average (DATA-01)** -- The requirement specifies "3-month rolling average" but the implementation shows current billing period usage. The user confirmed this is intentional and more accurate.

**Recommended resolution:** These gaps are candidates for overrides since the deviation was user-directed and improves data accuracy. Add overrides to accept the groups-table approach, then optionally explore whether PostHog groups table stores historical snapshots or whether another data source could provide trend data in a future phase.

**This looks intentional.** The data source switch was discovered during execution and confirmed by the user as a valid improvement. To accept these deviations, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "Usage trend direction (growing, stable, declining) is shown alongside the 3-month average"
    reason: "UGC data source switched from events table (only ~9 shops) to groups table (database source of truth). Groups table provides billing period snapshot, not monthly history needed for trend. Trend may be added later using a different data source."
    accepted_by: "aaron"
    accepted_at: "2026-04-27T21:36:19Z"
  - must_have: "Tool pulls UGC usage from PostHog as a 3-month rolling average"
    reason: "Replaced with current billing period usage from PostHog groups table (pricing_ugc_used/pricing_ugc_total). This is more accurate than events-based counting which only covered ~9 shops."
    accepted_by: "aaron"
    accepted_at: "2026-04-27T21:36:19Z"
```

Then re-run verification to apply.

---

_Verified: 2026-04-27T21:36:19Z_
_Verifier: Claude (gsd-verifier)_
