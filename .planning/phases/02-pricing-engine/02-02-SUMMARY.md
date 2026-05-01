---
phase: 02-pricing-engine
plan: 02
subsystem: pricing-engine
tags: [pricing, options, discounts, renewal-options]
dependency_graph:
  requires: [02-01]
  provides: [renewal-options-output]
  affects: [03-01]
tech_stack:
  added: []
  patterns: [discount-application, savings-comparison, already-optimal-detection]
key_files:
  created: []
  modified:
    - .claude/commands/scale.md
    - ~/.claude/commands/scale.md
decisions:
  - "Two options (annual 10%, 2-year 20%) instead of original 3 — per D-08"
  - "Discounts apply to both base plan AND add-on packs — per D-06"
  - "Already-optimal edge case shows only 2-year option — per discuss context"
  - "Cost increases shown explicitly, never hidden — per D-15"
metrics:
  duration: "inline"
  completed: "2026-04-28"
  status: "complete"
---

# Phase 2 Plan 2: Option Generation Summary

Added Step 8 (Generate Renewal Options) to the /scale skill file. Takes the optimal combo from Step 7 and produces 2 renewal options with commitment-based discounts and savings calculations.

## What Was Done

### Task 1: Add option generation step to scale.md

Added Step 8 with full renewal option generation:

**Option 1 — Annual Commitment (10% off):**
- 10% discount applied to both base plan and add-on packs
- Annual contract price calculated
- Savings vs current Stripe spend shown

**Option 2 — 2-Year Commitment (20% off):**
- 20% discount applied to both base plan and add-on packs
- Annual and 2-year contract prices calculated
- Savings vs current Stripe spend shown

**Already-optimal detection:**
- Compares current plan/price against optimal within $50/mo tolerance
- If already optimal, shows only the 2-year lock-in option

**All 7 display fields per option:**
1. Base plan name
2. Base plan price (discounted)
3. Number of UGC add-on packs
4. Add-on price (discounted)
5. Total monthly equivalent
6. Total annual/contract price
7. Savings vs current spend

Also updated Step 5 transition text from "Phase 2 will generate..." to "Calculating optimal pricing..."

## Deviations from Plan

None.

## Self-Check: PASSED

- FOUND: Step 8 in ~/.claude/commands/scale.md
- FOUND: "RENEWAL OPTIONS" output format
- FOUND: Annual Commitment (10% off) option
- FOUND: 2-Year Commitment (20% off) option
- FOUND: "vs Current" savings comparison
