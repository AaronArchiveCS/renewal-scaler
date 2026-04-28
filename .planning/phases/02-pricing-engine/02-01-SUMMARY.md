---
phase: 02-pricing-engine
plan: 01
subsystem: pricing-engine
tags: [pricing, algorithm, skill-file, ugc-optimization]
dependency_graph:
  requires: [01-02]
  provides: [pricing-table, optimal-combo-algorithm]
  affects: [02-02]
tech_stack:
  added: []
  patterns: [embedded-pricing-reference, plan-optimization-algorithm]
key_files:
  created: []
  modified:
    - .claude/commands/scale.md
    - ~/.claude/commands/scale.md
decisions:
  - "Pricing table embedded as markdown reference directly in skill file for portability"
  - "Algorithm shows full comparison breakdown across all 3 plans before stating optimal"
  - "Tie-breaking favors higher-tier plan (more credits at same price)"
metrics:
  duration: "182s"
  completed: "2026-04-28T17:44:09Z"
  status: "checkpoint-paused"
---

# Phase 2 Plan 1: Pricing Table and Optimal Combo Algorithm Summary

Archive pricing table (3 plans with monthly/annual/2-year tiers, UGC limits, credits) and UGC add-on definition embedded in skill file, plus optimization algorithm that finds cheapest base plan + add-on pack combination for any UGC usage level.

## What Was Done

### Task 1: Add pricing table and optimal combo algorithm to scale.md

Added two new steps to the `/scale` skill file after the existing Step 5 (Output):

**Step 6 -- Pricing Reference Data:**
- Complete pricing table with all 3 Archive plans (Startup, Growth, Enterprise)
- Monthly, annual (10% off), and 2-year (20% off) pricing for each plan
- UGC limits and credit allocations per plan
- UGC add-on pack definition: +500 UGC/mo at $250/mo, stackable, with discount rates
- Source-of-truth note reminding CSMs to update if pricing changes
- Credit add-ons and competitor add-ons explicitly excluded per D-03

**Step 7 -- Optimal Plan Calculation:**
- Algorithm iterates all 3 base plans, calculates UGC gap, determines packs needed via ceil(gap/500)
- Selects cheapest total monthly cost; ties broken by higher-tier plan (more credits)
- Zero/null usage edge case: recommends Startup with 0 add-ons (per D-12)
- High usage edge case: >15,000 UGC triggers custom pricing warning (per D-13)
- Shows full comparison breakdown table before stating the optimal combo
- Stores result for consumption by Step 8 (Phase 2 Plan 02)

### Task 2: Human Verification (checkpoint -- not yet executed)

Awaiting CSM verification of pricing calculations against a real customer.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | c25af58 | feat(02-01): add pricing table and optimal combo algorithm as Steps 6-7 |

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. Steps 6 and 7 are fully implemented with all pricing data and algorithm logic. Step 7 references "Step 8" which will be added by Phase 2 Plan 02.

## Self-Check: PASSED

- FOUND: .claude/commands/scale.md (repo copy)
- FOUND: ~/.claude/commands/scale.md (personal copy)
- FOUND: commit c25af58
- FOUND: Step 6 pricing table in skill file
- FOUND: Step 7 optimization algorithm in skill file
- FOUND: >15,000 UGC high usage warning
