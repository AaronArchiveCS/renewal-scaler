# Pitfalls Research

**Domain:** Internal pricing/renewal tool — multi-API data aggregation + optimization logic + HTML output
**Researched:** 2026-04-23
**Confidence:** HIGH (domain-specific, drawn from patterns in PostHog/Stripe/HubSpot integrations and pricing tool implementations)

---

## Critical Pitfalls

### Pitfall 1: Identity Resolution Failure Silently Returns Wrong Customer

**What goes wrong:**
The tool resolves a company name (e.g. "ACME Corp") to a Stripe customer and PostHog shop ID. If the match is fuzzy or ambiguous — parent companies, rebranded clients, test accounts, duplicate HubSpot records — the tool silently loads data for the wrong entity and produces a pricing recommendation based on someone else's usage. CSM walks into a renewal meeting with wrong numbers.

**Why it happens:**
Company names are not canonical keys. HubSpot allows duplicate company records. "Archive" shop IDs are the true universal key, but CSMs often trigger the skill with a name because that's what they know. The resolution step feels easy but is the most fragile part of the whole flow.

**How to avoid:**
- Always resolve to shop ID as the primary key before touching any other API.
- When resolution returns more than one match, surface all candidates and require the CSM to confirm before proceeding — never silently pick the first result.
- Show the resolved company name, shop ID, and HubSpot company ID in the output header so the CSM can visually sanity-check before reading the renewal options.
- Reject resolution if Stripe customer ID and HubSpot company do not map to the same shop ID.

**Warning signs:**
- CSM provides a name that exists in HubSpot more than once.
- Stripe customer has a different domain than the HubSpot company.
- PostHog returns no usage events for a shop ID that Stripe shows as active.

**Phase to address:** Phase 1 (Data Fetching / Identity Resolution)

---

### Pitfall 2: 3-Month Rolling Average Distorted by Onboarding Spikes or Seasonal Noise

**What goes wrong:**
The UGC usage average covers 90 days, but if the client onboarded 2 months ago their early spike data skews the average high, making them look like a heavier user than they are. Conversely, a client who normally uses 2,000 UGC/month but ran a slow Q4 will look underutilizing when they're actually at ceiling. The tool recommends the wrong plan tier.

**Why it happens:**
A rolling average treats all days equally. It doesn't know that the first 30 days of an account are anomalous, or that February is always slow in retail. The math is correct but the context is missing.

**How to avoid:**
- Surface the month-by-month breakdown alongside the average in the output — not just the single number. Let the CSM see the trend.
- Flag accounts where the most recent 30-day period differs from the 90-day average by more than 30% — this is a signal that the average is misleading.
- Consider weighting the most recent 30 days more heavily (e.g. 2x) than older months when calculating the "effective usage" used for plan recommendations.
- Note account age in the output header. If under 4 months, label the average as "early-stage estimate."

**Warning signs:**
- Month 1 usage is 3x+ higher than months 2-3 (onboarding spike).
- Usage in the final 30 days of the window is significantly lower than the 90-day average.
- PostHog shows zero events for stretches of the window (API integration may have been temporarily broken, not actual zero usage).

**Phase to address:** Phase 1 (Data Fetching) and Phase 2 (Pricing Logic)

---

### Pitfall 3: Discount Stacking Applied in Wrong Order Produces Incorrect Price

**What goes wrong:**
If Archive offers both a commitment discount (annual vs monthly) and a volume/tier discount, the order of operations matters. `base_price * (1 - commitment_discount) * (1 - volume_discount)` is not the same as applying them additively. If the pricing logic stacks discounts wrong, every single option in the output is priced incorrectly. CSMs quote clients the wrong number.

**Why it happens:**
Discount stacking rules are rarely documented explicitly. Developers guess the order, or apply discounts additively (adding percentages together and applying once) when they should be multiplicative (or vice versa). The error is invisible until someone cross-checks manually.

**How to avoid:**
- Document the exact discount application order in the pricing config before writing any calculation code — get this confirmed from Aaron / the pricing doc.
- Implement a `calculatePrice(basePlan, addOns, commitmentType)` function that has explicit, readable steps, not inline arithmetic.
- Include a "price derivation" line in the HTML output for each option showing how the final number was reached: `$X base - Y% commitment = $Z/month`. This lets the CSM catch any anomaly immediately.
- Write unit tests for the price calculation function covering: annual vs monthly, each plan tier, with and without add-ons, boundary cases (e.g. exactly at tier limit).

**Warning signs:**
- Annual plan price is not exactly `monthly * 12 * (1 - discount)`.
- A plan with add-ons prices out cheaper than the plan alone.
- Different commitment types produce prices that don't scale proportionally.

**Phase to address:** Phase 2 (Pricing Logic)

---

### Pitfall 4: UGC Limit Source-of-Truth Disagreement Between Stripe and HubSpot

**What goes wrong:**
The PROJECT.md notes that the UGC limit field location is TBD — either Stripe or a HubSpot field. If both are queried and they disagree (e.g. HubSpot was manually updated but Stripe was not, or vice versa), the tool may use the wrong baseline. A customer on a custom contract with a negotiated UGC limit will appear to be hitting their ceiling when they're actually within bounds.

**Why it happens:**
Internal tools often have two systems that are "supposed to stay in sync" but diverge over time due to manual overrides, sales exceptions, or migration lag. Neither system is definitively wrong — they represent different moments in time.

**How to avoid:**
- Establish a single source of truth before Phase 1 and document it in the pricing config. Do not query both and guess which is right.
- If Stripe is the billing source of truth, use Stripe. HubSpot is CRM, not billing.
- If the chosen field returns null or empty, surface a clear warning in the output: "UGC limit not found — confirm current plan terms before presenting options." Do not default to the plan's listed limit silently.

**Warning signs:**
- HubSpot UGC limit field and Stripe subscription metadata differ for the same customer.
- Field is empty for a subset of accounts (partial backfill problem, as seen with the HubSpot churn fields issue in the CS Control Center work).

**Phase to address:** Phase 1 (Data Fetching) — resolve before writing any pricing logic

---

### Pitfall 5: "Cheapest Valid Combination" Recommends a Downgrade Without Context

**What goes wrong:**
The optimizer correctly finds the cheapest plan + add-on combination that covers current usage. But a client currently on Growth at 2,500 UGC who only used 800 UGC last quarter — due to a known seasonal dip, or a paused campaign — gets a recommendation to drop to Startup. The CSM presents this in a renewal call and the client loses trust in Archive's understanding of their business.

**Why it happens:**
Pure math optimization doesn't know business context. The algorithm is correct given the inputs but the inputs don't include: "this account has growth potential," "they told us Q1 is always slow," or "they're mid-onboarding."

**How to avoid:**
- Always show three options with different rationales — not just cheapest. The three options should represent: (1) cost-optimized based on current usage, (2) right-sized for trend/growth, (3) current plan locked in (status quo, useful when client is happy and usage is stable).
- Never label option 1 as "recommended" if it's a downgrade from current plan — flag it as "usage-optimized" and let the CSM decide.
- Surface a utilization insight line in the output: "Currently using X% of plan limit. Last 3 months: [sparkline data or min/avg/max]." This gives the CSM talking points rather than letting the raw recommendation speak for itself.

**Warning signs:**
- The cost-optimized option is more than one tier below the current plan.
- Current usage is less than 40% of the plan limit.

**Phase to address:** Phase 2 (Pricing Logic) and Phase 3 (Output Generation)

---

### Pitfall 6: Missing API Data Causes Silent Wrong Output Instead of Explicit Error

**What goes wrong:**
One of three APIs is slow, returns a 429, or returns a partial result. The tool continues with null values substituted silently. The output looks complete — three nice options with prices — but is built on incomplete data. The CSM has no idea they're looking at fabricated numbers.

**Why it happens:**
Error handling is added after the happy path works. Early versions of the tool don't yet know what "partial data" looks like and treat `null` as 0 or skip the field. By the time the tool reaches the CSM, these silent failure modes have never been triggered.

**How to avoid:**
- Define required vs optional fields before writing fetch logic. Required fields: current plan, current price, UGC usage. Optional fields: seat count, workspace count.
- If any required field is missing or the API call fails, do not generate pricing options. Output a clear error card at the top of the HTML: "Could not load [source]: [field]. Pricing options not shown. Retry or check manually."
- Log which APIs were hit and what was returned in a collapsible debug section at the bottom of the HTML — this makes troubleshooting fast.
- Handle 429 rate limit responses explicitly: show "Rate limited by [API] — wait 60s and retry" rather than crashing.

**Warning signs:**
- A field in the output shows $0, 0 seats, or 0 UGC when that's implausible for an active customer.
- The tool completes unusually fast (may mean an API silently returned empty).

**Phase to address:** Phase 1 (Data Fetching)

---

### Pitfall 7: Cent-Level Rounding Errors Compound Across Annual Calculations

**What goes wrong:**
Monthly price is $833.33 (from a $10,000 annual plan / 12). Multiplied back to annual gives $9,999.96. Or add-on packs are priced at $X.YZ per 500 UGC and the math produces fractional cents. The output shows $9,999.96/yr instead of $10,000/yr — looks like a calculation error to the CSM and destroys trust in the tool.

**Why it happens:**
JavaScript floating point arithmetic on currency values without explicit rounding. Developers compute prices as decimals and only round at display time, but intermediate calculations accumulate error.

**How to avoid:**
- Store all prices as integers in cents (e.g. `83333` cents = $833.33), not as floats.
- Round displayed values to the nearest dollar for all options — CSMs don't need cent precision in a renewal conversation.
- The only place rounding decisions matter: round per-month down, round annual total to nearest dollar up (slightly in Archive's favor). Document this rule explicitly.
- Test: annual = monthly * 12 after rounding should equal the displayed annual price.

**Warning signs:**
- Output shows `.96` or `.04` on annual totals.
- Add-on packs show prices like `$166.666...`.

**Phase to address:** Phase 2 (Pricing Logic)

---

### Pitfall 8: Sequential API Calls Make the Tool Too Slow to Use in Practice

**What goes wrong:**
The tool makes three API calls sequentially: HubSpot to resolve company → Stripe to get plan/price → PostHog to get usage. Each call takes 1-3 seconds. Total wait: 6-9 seconds before any output. CSMs run this in the middle of pre-call prep and perceive it as broken or unreliable.

**Why it happens:**
Sequential is the simplest implementation. Developers fetch one thing, check the result, then fetch the next. The dependency chain feels necessary but often isn't — Stripe and PostHog can be called in parallel once the shop ID is resolved.

**How to avoid:**
- After resolving shop ID (which requires HubSpot first), fire Stripe and PostHog API calls in parallel using `Promise.all()`.
- Show a progress indicator during fetch — even a simple "Fetching Stripe... Fetching PostHog..." printed to Claude Code output so the CSM knows it's working.
- Target: total execution time under 5 seconds. If consistently over 5s, add caching for the pricing structure (which never changes per run) and consider whether PostHog's aggregation query can be pre-built as a saved insight.

**Warning signs:**
- Tool takes 10+ seconds and CSMs stop using it.
- Rate limit errors appear only when multiple CSMs use it simultaneously.

**Phase to address:** Phase 1 (Data Fetching)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode pricing tiers in the script | Faster to build | Every price change requires code edit; CSMs can't self-serve updates | Never — use a config file from day one |
| Skip the identity resolution confirmation step | Simpler UX, one fewer prompt | Silent wrong-customer data; trust-destroying errors | Never — always confirm resolved identity |
| Treat missing fields as 0 | No error handling needed | Generates plausible-looking but wrong output | Never for required fields |
| Use floating point for all price math | Trivially simple | Cent-level rounding errors on annual calculations | Never |
| Sequential API calls | Easier to debug early | 8-10s execution time; feels broken | Acceptable in very first prototype only |
| Omit the price derivation breakdown from HTML | Cleaner output | CSMs can't audit the math; errors go undetected | Never — derivation is a trust feature |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostHog | Querying raw events instead of a pre-built aggregation; full event scan is slow and rate-limited | Build a specific PostHog insight or use the `/query` endpoint with a tight time window filter |
| PostHog | Using `distinct_id` instead of shop ID as the group key — usage aggregation breaks for accounts with multiple users | Confirm the PostHog group property that maps to shop ID before writing any query |
| Stripe | Pulling `amount` from subscription without checking `interval` — a $500 monthly plan vs a $5,000 annual plan both return `amount` but mean very different things | Always check `interval` and `interval_count` and normalize to monthly equivalent |
| Stripe | Querying latest invoice instead of active subscription — invoices reflect past billing, subscriptions reflect current terms | Use `subscriptions.list` filtered by customer, check `status: active` |
| HubSpot | Company search by name returns multiple records with no clear canonical; picking the first result | Always surface all matches and require explicit confirmation when count > 1 |
| HubSpot | Custom properties not populated for all accounts (partial backfill) — returns `null` without error | Treat `null` from any custom property as "unknown," not as 0 or as the plan default |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all PostHog events for a shop and aggregating in-tool | Slow, rate-limited, returns massive payloads | Use PostHog's server-side aggregation via the query API with date filters | Any account with >6 months of events |
| Querying all HubSpot companies and filtering client-side | Slow, returns thousands of records | Use HubSpot's search API with company name or domain filter | Always — never fetch all |
| Calling Stripe `customers.list` without a filter | Returns paginated customer dump | Use `customers.search` with email or metadata filter | Always — never list without filter |
| Re-fetching Archive pricing structure from a static file on every run | Minor overhead only | Cache the pricing config in memory for the session | Not a real issue for a CLI tool, but avoid fetching from a URL each time |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging full API responses during debugging and leaving it on | Stripe responses contain PII (customer email, billing address) and pricing details | Log only field names and status codes in debug output, never raw response bodies |
| Embedding API keys in the skill script directly | Keys end up in git history if the file is ever committed | Read keys from environment variables (`process.env.STRIPE_KEY`), never hardcode |
| HTML output file written to a shared or synced directory | Internal pricing logic and customer data in a file that syncs to cloud or is accessible to others | Write output to a local temp directory or `~/Downloads` — confirm output path is local only |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Output is a wall of numbers without visual hierarchy | CSM can't quickly identify the three options and their key differences | Lead with a comparison card for each option — plan name, price, UGC included, commitment type — before any detail |
| Showing savings as a percentage only | "Save 17%" is meaningless in a sales conversation | Always show savings as an absolute dollar amount: "Save $1,200/year vs current spend" |
| No clear "current state" baseline in the output | CSM has to remember current price and plan separately | First section of output: "Current state — Plan X, $Y/month, Z UGC limit, N% utilized" |
| Output not readable when printed or saved as PDF | CSM wants to screenshot or print for notes | Use CSS `@media print` styles or at minimum avoid dark backgrounds; test print view before ship |
| Error messages buried at the bottom of output | CSM reads three options, then notices data was incomplete | Surface any data warnings in a red/yellow banner at the very top of the HTML |
| Three options that are too similar | CSM has nothing to anchor a negotiation conversation | Ensure options span a meaningful range — e.g. cheapest-valid, right-sized, premium — not three slight variants of the same tier |

---

## "Looks Done But Isn't" Checklist

- [ ] **Identity resolution:** Confirm the output shows the resolved company name AND shop ID AND HubSpot record ID — not just the name the CSM typed in
- [ ] **Pricing math:** Verify annual option price = monthly equivalent * 12 * (1 - discount) after rounding, for every option
- [ ] **Missing data handling:** Test with a company that has a null HubSpot UGC limit field — confirm tool errors gracefully, not silently
- [ ] **Downgrade detection:** Test with a client using <40% of plan limit — confirm output does not silently label a downgrade as "recommended"
- [ ] **Multi-match resolution:** Test with a company name that returns 2+ HubSpot records — confirm tool asks for clarification, does not pick first result
- [ ] **Price derivation visible:** Every pricing option shows the calculation breakdown, not just the final number
- [ ] **HTML print view:** Open the output in a browser and use print preview — confirm it's readable on paper

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong customer identity resolved | LOW | Re-run with explicit shop ID instead of company name; add confirmation step to Phase 1 |
| Discount stacking logic wrong | MEDIUM | Identify correct order from pricing doc, fix `calculatePrice()` function, retest all option outputs; no data migration needed |
| UGC source-of-truth disagreement | LOW | Decide canonical source (Stripe recommended), update fetch logic, document in config |
| Rounding errors in output | LOW | Switch to integer cents arithmetic; no logic change needed |
| Silent null data in output | HIGH (trust damage) | Add required-field validation gates before output generation; retroactively audit any outputs already given to CSMs |
| API rate limit blocks usage | LOW | Add explicit 429 handling with retry-after logic; stagger parallel calls if needed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Identity resolution failure | Phase 1 | Test with ambiguous company names; verify output shows resolved ID |
| Rolling average distortion | Phase 1 + Phase 2 | Output shows month-by-month breakdown; trend flag appears for volatile accounts |
| Discount stacking wrong order | Phase 2 | Unit test: annual price = monthly * 12 * (1 - discount) for all tiers |
| UGC limit source disagreement | Phase 1 | Config documents single source; null field produces explicit warning not 0 |
| Downgrade without context | Phase 2 + Phase 3 | No option labeled "recommended" if it's below current plan tier |
| Missing data silent failure | Phase 1 | Required fields validated before output generation; missing field shows error banner |
| Cent rounding errors | Phase 2 | All prices stored as integer cents; displayed values round to nearest dollar |
| Sequential API slowness | Phase 1 | Stripe + PostHog called in parallel after shop ID resolved; total time < 5s |
| HTML not print-ready | Phase 3 | Browser print preview tested; no dark backgrounds; savings shown in dollars |

---

## Sources

- Archive Technologies PROJECT.md — project requirements and open items (confirmed field ambiguities noted above)
- Pattern: HubSpot partial backfill problem — observed in Aaron's own CS Control Center work (churn fields 1/19 populated)
- Pattern: PostHog group analytics query performance — from PostHog API v2 documentation patterns
- Pattern: Stripe subscription vs invoice distinction — Stripe API documentation standard guidance
- Pattern: Currency integer arithmetic — standard practice in fintech/billing tools (Stripe's own SDK stores amounts in cents)
- Pattern: Silent null propagation — common failure mode in multi-API aggregation tools (observed in CS360 and CS Control Center builds)

---
*Pitfalls research for: Internal pricing/renewal tool (Renewal Scaler)*
*Researched: 2026-04-23*
