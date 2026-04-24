# Requirements: Renewal Scaler

**Defined:** 2026-04-23
**Core Value:** Give CSMs an instant, data-driven playing field of renewal options so they can walk into any renewal conversation prepared with the best-fit packages for the client's actual usage patterns.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Identity Resolution

- [ ] **IDENT-01**: CSM can trigger `/scale` with a company name and get results for that customer
- [ ] **IDENT-02**: CSM can trigger `/scale` with a shop ID and get results for that customer
- [ ] **IDENT-03**: Tool resolves customer identity consistently across PostHog, Stripe, and HubSpot
- [ ] **IDENT-04**: Tool surfaces disambiguation options when multiple companies match a name search

### Data Collection

- [ ] **DATA-01**: Tool pulls UGC usage from PostHog as a 3-month rolling average
- [ ] **DATA-02**: Tool pulls UGC limit from Stripe or HubSpot (field TBD)
- [ ] **DATA-03**: Tool pulls current plan name and pricing (monthly and annual) from Stripe
- [ ] **DATA-04**: Tool pulls number of active seats (active users)
- [ ] **DATA-05**: Tool pulls number of workspaces (shop IDs — TBD confirm)
- [ ] **DATA-06**: Tool shows usage trend direction (growing, stable, or declining) alongside the average

### Pricing Engine

- [ ] **PRICE-01**: Tool references Archive's full pricing structure (3 standard plans + UGC add-on packs)
- [ ] **PRICE-02**: Tool calculates the optimal plan + add-on combination that covers the client's actual usage
- [ ] **PRICE-03**: Tool generates 3 renewal options varying both plan level and commitment type
- [ ] **PRICE-04**: Tool applies discount rules based on commitment type (per pricing doc)
- [ ] **PRICE-05**: Tool adds headroom buffer to usage-based recommendations to prevent immediate overage

### Output & Presentation

- [ ] **OUT-01**: Output is a self-contained HTML document (inline CSS, no external dependencies)
- [ ] **OUT-02**: Output shows current state baseline (what the client pays now, what they use now)
- [ ] **OUT-03**: Each option shows annual savings vs current spend where applicable
- [ ] **OUT-04**: Output flags utilization insights (overpaying, underutilizing, hitting ceiling)
- [ ] **OUT-05**: Each option shows price derivation (how the price was calculated — base plan + add-ons + discount)
- [ ] **OUT-06**: Output shows data warning banners when fields are missing or uncertain
- [ ] **OUT-07**: Output is visually clean and structured for quick scanning, easy to screenshot or save as PDF

## v2 Requirements

### Enhanced Data

- **DATA-07**: Tool pulls Intercom ticket history to surface support load
- **DATA-08**: Tool pulls engagement score from PostHog activity metrics

### Workflow Integration

- **FLOW-01**: Tool auto-creates a HubSpot deal or task with the selected renewal option
- **FLOW-02**: Tool sends a summary to Slack with the recommended option

### Client-Facing Output

- **CLIENT-01**: Tool generates a client-facing proposal version (cleaned of internal insights)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Client-facing proposal document | Internal CSM prep tool only — v2 consideration |
| Auto-updating HubSpot records | Read-only tool — no write-back risk |
| Slack delivery of results | Claude Code skill output is sufficient for v1 |
| Custom/one-off pricing outside standard structure | Standard plans + add-ons only |
| Mobile or web dashboard | Claude Code skill — no separate UI needed |
| Multi-currency support | Archive operates in USD only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| IDENT-01 | Phase 1 | Pending |
| IDENT-02 | Phase 1 | Pending |
| IDENT-03 | Phase 1 | Pending |
| IDENT-04 | Phase 1 | Pending |
| DATA-01 | Phase 1 | Pending |
| DATA-02 | Phase 1 | Pending |
| DATA-03 | Phase 1 | Pending |
| DATA-04 | Phase 1 | Pending |
| DATA-05 | Phase 1 | Pending |
| DATA-06 | Phase 1 | Pending |
| PRICE-01 | Phase 2 | Pending |
| PRICE-02 | Phase 2 | Pending |
| PRICE-03 | Phase 2 | Pending |
| PRICE-04 | Phase 2 | Pending |
| PRICE-05 | Phase 2 | Pending |
| OUT-01 | Phase 3 | Pending |
| OUT-02 | Phase 3 | Pending |
| OUT-03 | Phase 3 | Pending |
| OUT-04 | Phase 3 | Pending |
| OUT-05 | Phase 3 | Pending |
| OUT-06 | Phase 3 | Pending |
| OUT-07 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-04-23*
*Last updated: 2026-04-23 after roadmap creation*
