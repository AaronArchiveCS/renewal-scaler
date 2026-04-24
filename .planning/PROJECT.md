# Renewal Scaler

## What This Is

A Claude Code skill (`/scale`) that lets CSMs quickly generate tailored renewal options for any client. It pulls the customer's current usage metrics, plan details, and pricing from multiple systems (PostHog, Stripe, HubSpot), cross-references Archive's current pricing structure, and produces a polished HTML document with three optimized renewal options — each combining the right plan tier, UGC add-on packs, and commitment-based discounts.

## Core Value

Give CSMs an instant, data-driven playing field of renewal options so they can walk into any renewal conversation prepared with the best-fit packages for the client's actual usage patterns.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CSM triggers `/scale` with a client name or shop ID
- [ ] Tool resolves customer identity across HubSpot (company name) and Stripe (shop ID)
- [ ] Tool pulls UGC usage from PostHog (3-month rolling average)
- [ ] Tool pulls UGC limit from Stripe or HubSpot (field TBD)
- [ ] Tool pulls number of active seats (active users)
- [ ] Tool pulls number of workspaces (likely individual shop IDs — TBD confirm)
- [ ] Tool pulls current plan and current price (monthly and annual) from Stripe
- [ ] Tool references Archive's current pricing structure (3 standard plans + UGC add-on packs)
- [ ] Tool calculates optimal plan + UGC add-on combinations based on actual usage
- [ ] Tool generates 3 renewal options varying both plan level and commitment type
- [ ] Each option shows annual savings vs current spend when applicable
- [ ] Tool surfaces utilization insights (overpaying, underutilizing, hitting ceiling)
- [ ] Output is a clean, visually structured HTML document (internal use, easy to screenshot or save as PDF)

### Out of Scope

- Client-facing proposal document — this is internal CSM prep only
- Sending the output directly to clients
- Auto-creating deals or updating HubSpot records
- Custom negotiation or one-off pricing outside the standard structure
- Mobile app or web dashboard — this is a Claude Code skill

## Context

- Archive has 3 standard plans (Startup at 500 UGC, Growth at 2,500 UGC, and a top tier)
- There's a gap between plan tiers where clients need more than one tier but far less than the next — UGC add-on packs fill this gap
- The intelligent part is finding the cheapest combination of base plan + add-ons that covers the client's actual usage, rather than pushing them to an oversized plan
- Discounts exist for different commitment types (details in pricing doc to be provided)
- CSMs currently have to manually piece together this information across multiple systems
- Data sources: PostHog (usage metrics), Stripe (billing/plan), HubSpot (company lookup, some account fields)
- Shop ID is the universal key across Archive's platforms

### Open Items

- Exact HubSpot field name for UGC limit — Aaron to confirm
- Whether workspaces = individual shop IDs — Aaron to confirm
- Full pricing structure document — Aaron to provide
- Discount tiers and rules — included in pricing doc

## Constraints

- **Runtime**: Claude Code skill — must work as a `/scale` command
- **Data sources**: PostHog API, Stripe API, HubSpot API — all accessible from existing integrations
- **Audience**: Internal CSM team only (Emanuel, Andres, Valentina, Natalia)
- **Output**: Single HTML file, visually clean, structured for quick scanning

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code skill over Slack bot or N8N | CSMs already use Claude Code; keeps it in their workflow | -- Pending |
| HTML output over Gamma/Notion | Portable, easy to PDF, no external dependencies | -- Pending |
| 3 options mixing plan level + commitment type | Gives CSMs a range to pitch from — not just "cheapest" | -- Pending |
| Show annual savings, not Archive revenue impact | CSM needs client-facing talking points, not internal metrics | -- Pending |
| Accept company name OR shop ID | Flexibility — CSMs know one or the other depending on context | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-23 after initialization*
