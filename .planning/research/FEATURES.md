# Feature Research

**Domain:** Internal CSM renewal pricing tool (Claude Code skill)
**Researched:** 2026-04-23
**Confidence:** HIGH for table stakes and differentiators (grounded in PROJECT.md requirements + CPQ/CS platform patterns); MEDIUM for anti-features (informed by CPQ failure modes and CS tool adoption research)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features CSMs assume exist. Missing these = the tool is not worth using and they go back to manual spreadsheets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Customer identity resolution (name or shop ID) | CSMs know accounts by company name OR shop ID depending on context — requiring one breaks flow | LOW | Fuzzy match on HubSpot company name; exact match on shop ID. Resolve to canonical shop ID early. |
| Pull current plan and price from Stripe | "What are they on now?" is the starting question for every renewal — if the tool doesn't know, it's useless | MEDIUM | Stripe subscription lookup by customer/shop ID. Expose both monthly and annual equivalents. |
| Pull UGC usage (3-month rolling average) from PostHog | Usage data is the primary input for right-sizing — without it, recommendations are guesses | MEDIUM | Rolling average smooths seasonal spikes. Requires PostHog project ID + shop ID as user identifier. |
| Surface utilization state clearly | CSMs need to instantly know: overpaying, at-limit, or leaving headroom. This shapes the entire conversation | LOW | Derived from usage vs. plan limit. Three states: underutilizing, well-matched, near/over ceiling. |
| Generate 3 renewal options | Industry standard for renewal conversations — one anchor, one recommended, one stretch. CSMs expect range not a single answer | MEDIUM | Vary by plan tier and commitment type, not just price. |
| Show annual vs monthly pricing for each option | Annual savings is the CSM's primary negotiating lever — if it's not visible, they have to calculate it manually | LOW | Display both; call out $ savings clearly for annual commitment. |
| Reference current pricing structure correctly | If the tool quotes wrong prices, the CSM walks into a conversation with bad numbers — trust is destroyed | LOW | Pricing structure baked into skill prompt/constants. Update when pricing changes. |
| Clean, scannable HTML output | CSMs need to act quickly on this — walls of text get ignored. Internal-use prep doc, not a client deliverable | MEDIUM | Card-per-option layout. Visual hierarchy: recommended option stands out. |

---

### Differentiators (Competitive Advantage)

Features that make this tool meaningfully better than a CSM doing manual research — and justify adoption.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Optimal plan + add-on calculation | The real intelligence: find the cheapest combination of base plan + UGC add-on packs that covers actual usage, rather than defaulting to an oversized plan. This is the hard math no CSM does manually | HIGH | Core algorithm. Enumerate combinations. Select minimum-cost bundle that covers 3-month rolling avg usage + reasonable headroom buffer (e.g., 10%). |
| Utilization insight narrative | Plain-language interpretation of what the data means: "They're using 91% of their UGC limit — add-on or upgrade is warranted" rather than raw numbers | LOW | Claude generation pass over raw data. One-sentence per key signal. |
| Savings framing vs current spend | Anchors the conversation in what the client gains, not what Archive earns. "You'd save $X/year by going annual" is a CSM talking point, not an internal metric | LOW | Requires current spend as baseline. Stripe provides this. |
| Commitment-based discount modeling | Show each option at monthly AND annual commitment so CSMs can trade commitment for price in the conversation | MEDIUM | Discount tiers in pricing constants. Apply discount schedule to each base option. |
| Overpaying/ceiling/headroom detection | Flags situations that require specific conversation approaches — an overpaying client needs a different pitch than one hitting a ceiling | LOW | Threshold-based rules: <50% utilization = overpaying; >85% = ceiling risk; 50-85% = well-matched. |
| Active seats and workspace data | Seat count and workspace count inform whether plan-level upgrades are warranted (not just UGC). Adds depth to the recommendation | MEDIUM | Pull from Stripe or HubSpot (field TBD per PROJECT.md open items). |
| Recommended option highlighted | One of the 3 options should be explicitly tagged as the CSM's starting pitch — reduces decision paralysis | LOW | Algorithm picks: cheapest option that covers usage + leaves 15% headroom AND includes annual commitment if savings > 10%. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Client-facing output formatting | Seems efficient — just send the CSM's prep doc to the client | This is an internal prep tool. Client-facing language, tone, and framing are different. Conflating them produces docs that are either too raw for clients or too polished to be fast for CSMs | Keep internal-only. If client docs are needed, build a separate skill that reformats the output |
| Auto-updating HubSpot with renewal options | Reduces manual entry — why not write back? | Writes to the system of record from a prep tool; creates noise if CSM doesn't use the recommended options; HubSpot becomes inconsistent | CSMs copy what they use into HubSpot manually after the conversation |
| Custom/one-off pricing outside standard structure | CSMs want to model exceptions (key account discounts, custom bundles) | Edge cases explode the pricing logic surface area. The tool's value is fast standard-case prep. Non-standard deals need Deal Desk involvement | Scope to standard plans + add-on packs only. Document clearly. Flag non-standard scenarios as "bring to Deal Desk" |
| Slack bot or N8N trigger | Seems lower-friction — just @-bot in Slack | Claude Code is already in the CSM workflow. Adding a Slack interface means a second interface to maintain, plus Slack's context window limitations hurt output quality | Stay as `/scale` Claude Code skill. CSMs who use Claude Code daily will use it |
| Real-time data refresh on each run | Fresh data every time feels more trustworthy | API calls to PostHog + Stripe + HubSpot take 5-15 seconds. Real-time adds latency with little benefit for renewal prep (data changes weekly, not hourly) | Accept minor staleness. Cache is fine. Flag data pull timestamp in output |
| Historical trend charts | "Show me usage over 12 months" sounds useful for context | Adds rendering complexity to the HTML output, requires more PostHog API calls, and CSMs need a number to act on — not a chart to interpret | Surface trend directionally in the utilization narrative: "usage has grown 40% over 3 months" without rendering charts |
| Email/PDF send from the tool | One-step delivery sounds efficient | Internal prep doc, not a deliverable. Sending it directly bypasses CSM judgment about what to actually share with the client | Output to HTML file. CSM screenshare, save, or print-to-PDF as needed |

---

## Feature Dependencies

```
[Customer identity resolution]
    └──required by──> [Stripe plan/price pull]
    └──required by──> [PostHog usage pull]
    └──required by──> [HubSpot seat/workspace pull]

[Stripe plan/price pull]
    └──required by──> [Annual savings framing vs current spend]
    └──required by──> [Utilization state detection]

[PostHog usage pull (3-month avg)]
    └──required by──> [Optimal plan + add-on calculation]
    └──required by──> [Utilization insight narrative]
    └──required by──> [Overpaying/ceiling/headroom detection]

[Optimal plan + add-on calculation]
    └──required by──> [Generate 3 renewal options]
    └──required by──> [Recommended option highlighted]

[Generate 3 renewal options]
    └──required by──> [Commitment-based discount modeling]
    └──required by──> [Show annual vs monthly pricing]
    └──required by──> [Clean HTML output]

[Utilization insight narrative]
    └──enhances──> [Clean HTML output]

[Overpaying/ceiling/headroom detection]
    └──enhances──> [Utilization insight narrative]

[Active seats and workspace data]
    └──enhances──> [Optimal plan + add-on calculation] (adds dimension beyond UGC)
```

### Dependency Notes

- **Identity resolution is the root dependency:** All data pulls depend on resolving a valid shop ID. If this fails, nothing else works. It must be bulletproof with clear error messaging.
- **Usage pull enables the core algorithm:** The optimal plan+add-on calculation is the differentiating feature. Without PostHog UGC data, the tool falls back to guessing — making it no better than what CSMs currently do.
- **Current price from Stripe enables savings framing:** Without knowing current spend, the tool can't tell CSMs how much a client saves. Annual savings framing is a key CSM conversation anchor.
- **Optimal calculation gates option generation:** The 3-option output is downstream of the algorithm. Build and test the algorithm first before investing in output formatting.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate that the tool saves CSMs time and produces trustworthy output.

- [ ] Customer identity resolution (company name OR shop ID → canonical shop ID) — gatekeeper for everything
- [ ] Pull current plan + price from Stripe — establishes baseline
- [ ] Pull 3-month UGC rolling average from PostHog — primary sizing input
- [ ] Optimal plan + add-on combination calculation — the differentiating intelligence
- [ ] Generate 3 renewal options (vary tier + commitment type) — the deliverable
- [ ] Show annual vs monthly for each option with $ savings — CSM talking point
- [ ] Utilization state detection (overpaying / well-matched / ceiling risk) — conversation shaper
- [ ] Clean HTML output, one card per option, recommended option marked — usable without explanation

### Add After Validation (v1.x)

Features to add once core flow is working and CSMs have used it on real renewals.

- [ ] Active seats and workspace data — add when PROJECT.md open item on field names is resolved
- [ ] Utilization insight narrative (plain-language interpretation) — add when CSMs report needing more talking points
- [ ] Savings vs current spend framing — add when CSMs confirm they use annual savings as a primary lever

### Future Consideration (v2+)

Features to defer until the v1 workflow has been validated in real renewal conversations.

- [ ] Trend direction in utilization narrative ("usage up 40% in 3 months") — useful context but requires time-series PostHog query, not just rolling avg
- [ ] Multi-workspace rollup — relevant only once workspace = shop ID question is confirmed and multi-workspace accounts are identified as a common pattern
- [ ] Pricing structure version control — defer until pricing changes often enough to cause errors in practice

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Customer identity resolution | HIGH | LOW | P1 |
| Stripe plan/price pull | HIGH | LOW | P1 |
| PostHog UGC rolling average | HIGH | MEDIUM | P1 |
| Optimal plan + add-on calculation | HIGH | HIGH | P1 |
| Generate 3 renewal options | HIGH | MEDIUM | P1 |
| Annual vs monthly + $ savings | HIGH | LOW | P1 |
| Utilization state detection | HIGH | LOW | P1 |
| Clean HTML output | HIGH | MEDIUM | P1 |
| Recommended option highlighted | MEDIUM | LOW | P2 |
| Utilization insight narrative | MEDIUM | LOW | P2 |
| Commitment-based discount modeling | MEDIUM | MEDIUM | P2 |
| Active seats/workspace data | MEDIUM | MEDIUM | P2 |
| Savings vs current spend framing | MEDIUM | LOW | P2 |
| Usage trend direction | LOW | MEDIUM | P3 |
| Multi-workspace rollup | LOW | HIGH | P3 |
| Pricing structure version control | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch — tool is not useful without these
- P2: Should have — add in first iteration after launch validation
- P3: Nice to have — defer until product-market fit established

---

## Competitor Feature Analysis

This tool has no direct competitors — it's a bespoke internal skill. The relevant reference class is CPQ software (Salesforce CPQ, DealHub, Zuora) and CS platform renewal modules (Gainsight Renewal Center, ChurnZero, Planhat).

| Feature | CPQ Tools (Salesforce/DealHub) | CS Platforms (Gainsight/Planhat) | Our Approach |
|---------|-------------------------------|----------------------------------|--------------|
| Identity resolution | CRM-native, requires correct CRM data | Health score + CRM sync | Accept company name OR shop ID; resolve via HubSpot + Stripe |
| Usage data ingestion | External via integration, often delayed | Health score aggregation, not raw usage | Direct PostHog API pull, 3-month rolling avg |
| Plan/price calculation | Full CPQ engine, handles complex rules | Limited — surfaces renewal ARR, not optimal plan | Focused algorithm: cheapest bundle covering actual usage |
| Option presentation | Quote documents with line items | Renewal Center shows one number | 3 options, visual hierarchy, recommended marked |
| Output format | Formal quote PDF, CRM-synced | Dashboard widget, Salesforce record | Self-contained HTML, no dependencies, easy to screenshot/PDF |
| Discount modeling | Rule-based, approval workflows | Static playbook triggers | Simple commitment tiers, no approval needed |
| Adoption barrier | Requires admin setup, training, licensing | Requires Gainsight seat, HubSpot sync | Zero setup for CSMs — runs as `/scale` command they already use |

The competitive insight: enterprise CPQ tools are powerful but heavyweight. CS platforms surface renewal signals but don't generate option-level pricing math. This tool fills the gap with a minimal, purpose-built skill that a CSM can invoke in 30 seconds.

---

## Sources

- [Gainsight Renewal Center features](https://saleshive.com/vendors/gainsight/) — MEDIUM confidence (review aggregator, not official docs)
- [CPQ software capabilities overview](https://www.salesforce.com/sales/cpq/what-is-cpq/) — HIGH confidence (Salesforce official)
- [DealHub CPQ — renewal and subscription features](https://dealhub.io/glossary/deal-desk/) — MEDIUM confidence
- [ChurnZero vs Planhat comparison](https://www.velaris.io/comparison/churnzero-vs-planhat) — MEDIUM confidence (comparison site)
- [CSM renewal playbook patterns](https://churnzero.com/blog/customer-renewal-strategy/) — MEDIUM confidence
- [SaaS annual savings calculator patterns](https://www.interactivecalculator.com/examples/saas-pricing-calculator) — MEDIUM confidence
- [CPQ for subscriptions — renewal and upsell](https://www.netsuite.com/portal/resource/articles/erp/configure-price-quote-cpq.shtml) — HIGH confidence (NetSuite official)
- PROJECT.md requirements — HIGH confidence (primary source, Aaron-authored)

---

*Feature research for: CSM renewal pricing tool (Claude Code `/scale` skill)*
*Researched: 2026-04-23*
