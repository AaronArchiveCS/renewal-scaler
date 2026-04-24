# Roadmap: Renewal Scaler

## Overview

Three phases matching the natural dependency chain: resolve who the customer is and get their data, compute the right pricing options, then render a clean document CSMs can actually use. No phase is useful without the one before it — identity must be confirmed before data is fetched, data must be validated before pricing is calculated, and pricing must be correct before it's rendered. Each phase delivers something that can be tested against real accounts before the next phase begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Data Layer** - Resolve customer identity and pull validated data from PostHog, HubSpot, and Stripe
- [ ] **Phase 2: Pricing Engine** - Calculate optimal plan + add-on combinations and generate 3 renewal options
- [ ] **Phase 3: HTML Output** - Render a clean, self-contained document CSMs can screenshot or save as PDF

## Phase Details

### Phase 1: Data Layer
**Goal**: CSM can run `/scale [name or shop ID]` and get back a confirmed customer profile with validated usage, plan, and billing data from all three systems
**Depends on**: Nothing (first phase)
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06
**Success Criteria** (what must be TRUE):
  1. CSM runs `/scale acme` and the tool surfaces all HubSpot matches — never silently picks one
  2. CSM runs `/scale shop_12345` and the tool resolves the company name and confirms the match before proceeding
  3. When identity is confirmed, the tool returns UGC rolling average, UGC limit, current plan name, monthly and annual price, active seats, and workspace count from their respective sources
  4. When any required field (plan, price, UGC usage) is missing or null, the tool stops and surfaces an explicit error — it does not proceed to produce pricing output
  5. Usage trend direction (growing, stable, declining) is shown alongside the 3-month average
**Plans**: TBD

Plans:
- [ ] 01-01: Skill skeleton + identity resolution (HubSpot search, disambiguation, shop ID confirmation)
- [ ] 01-02: Parallel data fetch (PostHog UGC rolling avg + trend, HubSpot plan/seats/UGC limit, Stripe billing baseline)

### Phase 2: Pricing Engine
**Goal**: Given a validated customer profile, the tool calculates the cheapest plan + add-on combination covering actual usage and produces 3 distinct renewal options with correct pricing
**Depends on**: Phase 1
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05
**Success Criteria** (what must be TRUE):
  1. The tool selects the cheapest base plan + UGC add-on combination that covers 3-month usage plus 20% headroom — not the next plan up
  2. Three options are generated varying both plan level and commitment type, each with a distinct rationale
  3. Discount rules from the pricing doc are applied in the correct order — price derivation is transparent and auditable
  4. No option is labeled "recommended" if it represents a downgrade from the client's current plan
**Plans**: TBD

Plans:
- [ ] 02-01: Embedded pricing table + optimization rules (cheapest plan+add-on combo, headroom buffer, utilization classification)
- [ ] 02-02: Option generation (3 options, commitment-type variants, discount application, savings calculation)

### Phase 3: HTML Output
**Goal**: Pricing output renders as a self-contained HTML document with a current state baseline, 3 option cards, utilization insights, and error banners — ready to screenshot or print to PDF
**Depends on**: Phase 2
**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04, OUT-05, OUT-06, OUT-07
**Success Criteria** (what must be TRUE):
  1. Output is a single HTML file with inline CSS — opens in any browser, no external dependencies, prints cleanly to PDF
  2. Current state baseline (what the client pays now, what they use, utilization %) is visible at the top before any options
  3. Each option card shows price derivation (base plan + add-ons + discount = final price) so CSMs can explain the math
  4. Utilization insight (overpaying, well-matched, ceiling risk) and annual savings figures appear in dollar amounts, not percentages
  5. Missing or uncertain data fields show warning banners at the top of the document — not buried at the bottom
**Plans**: TBD

Plans:
- [ ] 03-01: HTML template (current state header, option cards, utilization insight, data warning banners, print CSS)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Layer | 0/2 | Not started | - |
| 2. Pricing Engine | 0/2 | Not started | - |
| 3. HTML Output | 0/1 | Not started | - |
