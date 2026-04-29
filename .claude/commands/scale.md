# Scale Renewal Tool

Resolve customer identity and return a validated data profile for renewal planning.

## Input

The user will provide: `$ARGUMENTS`

Parse the argument to determine the input type:

- **Shop ID** — If `$ARGUMENTS` is purely numeric (e.g., `12345`) OR matches the pattern `shop_NNNNN` or `shop-NNNNN`, treat it as a shop ID lookup.
- **Company name** — Otherwise, treat the entire argument string as a company name search.

If no argument is provided, respond:
> Please provide a company name or shop ID. Usage: `/scale acme corp` OR `/scale 12345`

Then stop and wait for the user to re-run the command with an argument.

## Execution Steps

Execute these steps in order. **Do NOT proceed past identity resolution without explicit CSM confirmation.** **Do NOT silently pick the first match when multiple results are returned.**

<!-- IMPORTANT: This skill must run inline in the conversation for interactive disambiguation. Do NOT run this as a forked subagent — it would lose conversation history and break the multi-turn flow. -->

### Step 1: Identity Resolution (HubSpot)

Tell the user: **"Searching HubSpot for '[input]'..."**

Follow the branch that matches the input type:

---

**Branch A: Company Name Search**

Use `mcp__claude_ai_HubSpot__search_crm_objects` with:
- `objectType`: `"companies"`
- `query`: the company name from `$ARGUMENTS`
- `properties`: `["name", "shop_id", "customer_tier", "lifecyclestage", "arr__active_deals_"]`

Then handle the results:

**0 results:**
> No company found matching "[name]". Check the spelling or try a shop ID: `/scale <shop_id>`

Stop here.

**1 result:**

Tell the user: **"Found 1 match."**

Proceed directly to Step 2 with this company. No confirmation needed for single name matches.

**2-5 results:**

Tell the user: **"Found [N] matches."**

Present a numbered list:
```
Found [N] companies matching "[name]":
1. [Company Name] — shop_id: [id] — Tier: [tier]
2. [Company Name] — shop_id: [id] — Tier: [tier]
3. [Company Name] — shop_id: [id] — Tier: [tier]
...

Which company? Enter a number.
```

**Wait for the CSM's response.** Use the selected company for Step 2.

**More than 5 results:**
> Too many matches for "[name]" ([N] found). Please re-run with a shop ID: `/scale <shop_id>`

Stop here.

---

**Branch B: Shop ID Lookup**

Use `mcp__claude_ai_HubSpot__search_crm_objects` with:
- `objectType`: `"companies"`
- `filterGroups`: `[{ "filters": [{ "propertyName": "shop_id", "operator": "EQ", "value": "<shop_id>" }] }]`
- `properties`: `["name", "shop_id", "customer_tier", "lifecyclestage", "arr__active_deals_"]`

Then handle the results:

**0 results:**
> No company found with shop ID "[id]". Verify the ID and try again.

Stop here.

**1 or more results:**

Tell the user: **"Found 1 match."**

Show a confirmation prompt:
> Found: **[Company Name]** (shop_id: [id], Tier: [tier]). Is this correct?

**Wait for CSM confirmation before proceeding.** If they say no, ask them to re-run with the correct identifier.

---

### Step 2: Workspace Scope

After the company is confirmed, extract the `shop_id` value from the selected HubSpot company record.

**Important:** The `shop_id` field may contain multiple IDs in a single value. Check if the value contains commas, semicolons, or newlines. If it does, split on that delimiter to get all shop IDs. If it is a single value, treat it as a list of one.

Show the CSM what was found:
```
Workspaces found for [Company Name]: [list of shop IDs]

Does this customer have other workspaces we should include? Enter additional shop IDs separated by commas, or type "no" to continue.
```

**Wait for the CSM's response.**

- If they provide additional shop IDs, add them to the list.
- If they say "no" (or similar), proceed with just the extracted IDs.

Tell the user: **"Workspace scope confirmed: [N] shop ID(s)."**

Store the final list of shop IDs for use in Step 3.

### Step 3: Parallel Data Fetch

Now fetch usage and billing data from PostHog and Stripe simultaneously. Use the shop ID list from Step 2 for all queries.

---

**3A: PostHog — UGC Usage and Limit (from groups table)**

Tell the user: **"Fetching PostHog usage data..."**

Use `mcp__claude_ai_PostHog__query-run` with this HogQL query. For multi-workspace customers, run one query per shop ID and sum the results.

```json
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT key AS shop_id, JSONExtractString(properties, 'shop_name') AS shop_name, JSONExtractFloat(properties, 'pricing_ugc_used') AS ugc_used, JSONExtractFloat(properties, 'pricing_ugc_total') AS ugc_total, JSONExtractFloat(properties, 'pricing_credits_used') AS credits_used, JSONExtractFloat(properties, 'pricing_credits_total') AS credits_total FROM groups WHERE key IN ('{shop_id_1}', '{shop_id_2}') LIMIT 10"
  }
}
```

Replace the `IN (...)` clause with the actual shop IDs from Step 2.

From the results, extract:

- **UGC Used**: `pricing_ugc_used` — current billing period UGC consumed. For multi-workspace customers, sum across all shop IDs.
- **UGC Limit**: `pricing_ugc_total` — current billing period UGC allowance. For multi-workspace, sum across all shop IDs.
- **Utilization %**: `ugc_used / ugc_total * 100`, rounded to nearest integer.
- **Credits Used / Credits Total**: If non-zero, include in output as supplementary data.

**Note:** The `groups` table is the source of truth for UGC usage — it reflects the database, not frontend analytics events. The `events` table (`crm.shop_item.created`) only covers a small fraction of shops and is unreliable for UGC counts.

If the query returns no rows for a shop ID, warn: "Shop ID [id] not found in PostHog groups table — verify it exists in the system."

Tell the user: **"PostHog UGC data... done."**

---

**3B: PostHog — Active Seats (last 90 days)**

Tell the user: **"Fetching PostHog active seat count..."**

Use `mcp__claude_ai_PostHog__query-run` with this HogQL query:

```json
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT COUNT(DISTINCT person_id) AS active_seats FROM events WHERE event = '$pageview' AND properties.shop_id IN ('{shop_id_1}', '{shop_id_2}') AND timestamp >= now() - INTERVAL 90 DAY"
  }
}
```

Replace shop IDs as above.

**Important:** Use `$pageview` as the activity proxy, NOT `auth.user.logged_in` — that event only started March 24, 2026 and does not have enough historical data for reliable counts.

Tell the user: **"PostHog seat count... done."**

---

**3C: Stripe — Plan, Pricing, and UGC Limit**

Tell the user: **"Fetching Stripe billing data..."**

The Stripe lookup uses a cascading strategy. Try each approach in order until a subscription is found:

**Approach 1 — Stripe Customer ID from HubSpot (preferred):**

Check if the HubSpot company record from Step 1 has a `stripe_customer_id` property. If it is populated, use:

```
mcp__claude_ai_Stripe__list_subscriptions
  customer: "<stripe_customer_id>"
```

**Approach 2 — Search Stripe by shop_id metadata (fallback):**

If no `stripe_customer_id` was found on the HubSpot record, search Stripe subscriptions by shop_id metadata:

```
mcp__claude_ai_Stripe__search_stripe_resources
  resource: "subscriptions"
  query: "metadata['shop_id']:'<shop_id>'"
```

Use the first (primary) shop ID from Step 2.

**Approach 3 — Search Stripe by company name (last resort):**

If Approaches 1 and 2 both return no results, search Stripe customers by company name:

```
mcp__claude_ai_Stripe__search_stripe_resources
  resource: "customers"
  query: "name:'<company_name>'"
```

Then use the matched customer's ID to list subscriptions:

```
mcp__claude_ai_Stripe__list_subscriptions
  customer: "<matched_customer_id>"
```

---

**Once a subscription is found, extract the following:**

**Plan name:**

Get the product linked to the subscription's price. The subscription response contains `items.data[0].price.product` (a product ID). Fetch the full product:

```
mcp__claude_ai_Stripe__fetch_stripe_resources
  resource: "products/<product_id>"
```

The product `name` is the plan name.

**Monthly and annual price:**

Get the price object from the subscription's `items.data[0].price` (or fetch it if only the ID is available):

```
mcp__claude_ai_Stripe__fetch_stripe_resources
  resource: "prices/<price_id>"
```

- If `recurring.interval` is `"month"`: monthly price = `unit_amount / 100`. Annual price = monthly * 12.
- If `recurring.interval` is `"year"`: annual price = `unit_amount / 100`. Monthly price = annual / 12.
- If `unit_amount` is null but the subscription has a different amount field, use that.

**UGC limit:**

The UGC limit is already retrieved from PostHog's `groups` table in Step 3A (`pricing_ugc_total`). This is the database source of truth. No need to extract it from Stripe metadata.

If the Stripe price nickname contains a UGC number (e.g., "C1 - 250 UGC", "CN5 5,000 UGC"), note it as a cross-reference but prefer the `pricing_ugc_total` value from PostHog.

Tell the user: **"Stripe billing data... done."**

---

### Step 4: Validation

After all data is fetched, validate the results before producing output.

**Critical fields — hard-stop if missing (per D-13):**

These fields are required. If any are null, missing, or could not be retrieved, **stop immediately** and show the error. Do NOT produce partial output.

- **Plan name:** If null or missing, stop and show:
  > MISSING: Plan name — could not find an active Stripe subscription for [Company Name]. Stripe customer: [stripe_id or "not found"]. Check Stripe manually and verify the customer has an active subscription.

- **Current price:** If null or missing, stop and show:
  > MISSING: Current price — Stripe subscription [sub_id] does not have a valid price object. Check the price configuration in Stripe for this subscription.

- **UGC usage:** If the PostHog groups query returned an error or no rows for any shop ID, stop and show:
  > MISSING: UGC usage — PostHog groups query failed for shop_id(s) [ids]. Error: [error message]. Check if these shop IDs exist in PostHog project 192859.

  Note: Zero UGC used (`pricing_ugc_used = 0`) is a valid result (low-activity customer), NOT a missing field. Only hard-stop if the query itself errored or returned no rows.

**Secondary fields — warn and continue (per D-13):**

These fields are helpful but not blocking. If missing, add a warning to the output and proceed.

- **Active seats:** If PostHog returned no data or an error:
  > WARNING: Could not determine active seat count. PostHog $pageview query returned no data for shop_id(s) [ids].

- **UGC limit:** If `pricing_ugc_total` is 0 or null in the groups table:
  > WARNING: UGC limit is 0 or not set in PostHog groups table for shop_id(s) [ids]. Verify the limit in Stripe or admin dashboard.

- **Workspace count:** If shop_id extraction had issues in Step 2:
  > WARNING: Could not confirm workspace count. Raw shop_id field value: [raw value].

**API failure — immediate stop (per D-15):**

If any MCP tool call fails with an error response, connection error, or timeout, **stop immediately** and show:

> ERROR: [System name — HubSpot / PostHog / Stripe] is unreachable. Tool call failed: [error message]. Re-run `/scale` when the system is available.

Do NOT silently retry. Do NOT continue with partial data from other systems.

---

### Step 5: Output

Display a structured text summary with all collected data. Use this exact format:

```
=== CUSTOMER DATA PROFILE ===

Company:        [Company Name]
Customer Tier:  [customer_tier from HubSpot]
Shop ID(s):     [comma-separated list from Step 2]
Workspaces:     [count of shop IDs]

--- Current Plan ---
Plan:           [Plan name from Stripe product]
Monthly Price:  $[amount, formatted with commas]
Annual Price:   $[amount, formatted with commas]

--- UGC Usage (current billing period) ---
UGC Used:       [pricing_ugc_used] / [pricing_ugc_total]
Utilization:    [ugc_used / ugc_total * 100, rounded]%
Credits Used:   [pricing_credits_used] / [pricing_credits_total] (if non-zero, otherwise omit this line)

--- Seats ---
Active Seats:   [count] (last 90 days)

--- Warnings ---
[Any warning messages from Step 4, each on its own line. If no warnings, show: "None"]

Data collection complete. Calculating optimal pricing...
```

**Notes:**
- All monetary values should include dollar signs and comma separators (e.g., $1,200 not $1200).
- UGC data comes from PostHog's `groups` table (database source of truth), not the `events` table. The `events` table events like `crm.shop_item.created` only cover ~9 shops and are unreliable for UGC counts.

---

### Step 6: Pricing Reference Data

> **This pricing table is the source of truth for renewal calculations. If Archive's pricing changes, update this table.**

Use the following pricing structure for all renewal calculations:

**Base Plans:**

| Plan | Monthly | Annual (10% off) | 2-Year (20% off) | UGC Limit | Credits |
|------|---------|-------------------|-------------------|-----------|---------|
| Startup | $500/mo | $5,400/yr ($450/mo) | $9,600/yr ($400/mo) | 500/mo | 20,000/mo |
| Growth | $1,500/mo | $16,200/yr ($1,350/mo) | $28,800/yr ($1,200/mo) | 2,500/mo | 70,000/mo |
| Enterprise | $5,000/mo | $54,000/yr ($4,500/mo) | $96,000/yr ($4,000/mo) | 10,000/mo | 150,000/mo |

**UGC Add-on Pack:** +500 UGC/mo for $250/mo. Stackable (customer can buy multiple packs). Same discount rates apply:
- Annual commitment: $250/mo * 0.90 = $225/mo per pack ($2,700/yr per pack)
- 2-Year commitment: $250/mo * 0.80 = $200/mo per pack ($4,800/yr per pack)

**Not in scope:** Credit add-ons and extra competitor add-ons are excluded from renewal pricing calculations.

Tell the user: **"Pricing table loaded. Calculating optimal plan..."**

---

### Step 7: Calculate Optimal Plan + Add-on Combination

Using the customer's UGC usage from the CUSTOMER DATA PROFILE output in Step 5, find the cheapest base plan + UGC add-on combination that covers their actual usage. No headroom buffer -- match actual usage exactly.

**Algorithm:**

1. Read `pricing_ugc_used` from the Step 5 output (the UGC Used value).

2. **Zero or null usage:** If `pricing_ugc_used` is 0 or null (valid data, not a missing field), recommend Startup with 0 add-on packs at $500/mo. Skip to the output step below.

3. **For each base plan** (Startup, Growth, Enterprise), calculate:
   - UGC gap = `pricing_ugc_used` - plan's UGC limit
   - If gap <= 0: packs needed = 0 (the plan covers all usage)
   - If gap > 0: packs needed = ceil(gap / 500)
   - Total monthly cost = plan's monthly price + (packs needed * $250)
   - Store: plan name, plan monthly price, UGC limit, packs needed, add-on monthly cost (packs * $250), total monthly cost

4. **Select the combination with the lowest total monthly cost.** If two combinations tie on cost, prefer the one with the higher-tier plan (it includes more credits).

5. **High usage warning:** If `pricing_ugc_used` exceeds 15,000, still calculate the optimal combo but append this warning after the result:
   > NOTE: This customer uses [N] UGC/mo, which requires [X] add-on packs on top of Enterprise. Custom pricing may be more appropriate -- consult with leadership before presenting these options.

6. **Show the calculation breakdown:**

```
=== OPTIMAL PLAN CALCULATION ===

Customer UGC Usage: [pricing_ugc_used]/mo

--- Comparison ---
Startup ($500/mo, 500 UGC):      + [N] add-on packs ($[cost]/mo) = $[total]/mo
Growth ($1,500/mo, 2,500 UGC):   + [N] add-on packs ($[cost]/mo) = $[total]/mo
Enterprise ($5,000/mo, 10,000 UGC): + [N] add-on packs ($[cost]/mo) = $[total]/mo

>>> Optimal: [Plan Name] + [N] UGC add-on pack(s) = $[total_monthly]/mo
```

Tell the user: **"Optimal plan calculated: [Plan Name] + [N] UGC add-on pack(s) at $[total_monthly]/mo."**

Store the optimal combo result (plan name, packs needed, total monthly cost) for use in Step 8.

---

### Step 8: Generate Renewal Options

Using the optimal combo from Step 7 and the customer's current pricing from Step 5, generate two renewal options with commitment-based discounts.

**Before generating options, check if the customer is already optimal:**

Compare the customer's current plan name (from Step 5) against the optimal plan name (from Step 7), and compare the customer's current monthly price against the optimal annual-discounted monthly rate (within $50/mo tolerance to account for rounding). If BOTH match, the customer is already on the optimal plan at a competitive rate. In that case, show:

```
=== RENEWAL OPTIONS ===

This customer is already on the optimal plan ([Plan Name]) at a competitive rate.
Current: $[current_monthly]/mo | Optimal annual: $[optimal_annual_monthly]/mo
No plan change recommended. Consider a 2-year lock-in for additional savings.
```

Then show ONLY Option 2 (the 2-year commitment) since the annual option would be redundant. Skip Option 1 below.

**If the customer is NOT already optimal (normal case), generate both options:**

**Option 1: Annual Commitment (10% off)**

Apply 10% discount to BOTH the base plan monthly rate AND each add-on pack monthly rate:
- Base plan discounted monthly: `plan_monthly * 0.90`
- Each add-on pack discounted monthly: `$250 * 0.90 = $225`
- Total monthly equivalent: `base_discounted + (packs * $225)`
- Annual contract price: `total_monthly_equivalent * 12`

**Option 2: 2-Year Commitment (20% off)**

Apply 20% discount to BOTH the base plan monthly rate AND each add-on pack monthly rate:
- Base plan discounted monthly: `plan_monthly * 0.80`
- Each add-on pack discounted monthly: `$250 * 0.80 = $200`
- Total monthly equivalent: `base_discounted + (packs * $200)`
- Annual contract price: `total_monthly_equivalent * 12`
- Total 2-year contract price: `annual_price * 2`

**Savings calculation:**

For each option, calculate:
- Customer's current annual spend: `current_monthly_price * 12` (from Step 5's Monthly Price). If Step 5 already has an annual figure, use that directly.
- Recommended annual spend: the annual contract price from the option
- Annual savings: `current_annual - recommended_annual`
- If savings is negative (recommended costs MORE than current), show the increase amount and note it explicitly. Do not hide cost increases.

**No volume discounts, no loyalty discounts, no custom pricing.** Only the standard 10% annual and 20% 2-year discount rates apply.

**Output format -- present both options as structured blocks:**

```
=== RENEWAL OPTIONS ===

Current spend: $[current_monthly]/mo ($[current_annual]/yr) on [current_plan_name]
Recommended plan: [optimal_plan_name] + [N] UGC add-on pack(s)

--- Option 1: Annual Commitment ---
Base plan:       [Plan Name] @ $[discounted_monthly]/mo (10% off $[list_monthly])
UGC add-ons:     [N] pack(s) @ $[discounted_addon_monthly]/mo each (10% off $250)
Monthly total:   $[total_monthly]
Annual price:    $[annual_total]
vs Current:      $[savings]/yr [savings | increase]

--- Option 2: 2-Year Commitment ---
Base plan:       [Plan Name] @ $[discounted_monthly]/mo (20% off $[list_monthly])
UGC add-ons:     [N] pack(s) @ $[discounted_addon_monthly]/mo each (20% off $250)
Monthly total:   $[total_monthly]
Annual price:    $[annual_total]
2-Year total:    $[two_year_total]
vs Current:      $[savings]/yr [savings | increase]
```

**Display fields per option (all 7 required):**
1. Base plan name (e.g., "Growth")
2. Base plan price (discounted monthly rate)
3. Number of UGC add-on packs (e.g., "2 packs")
4. Add-on price (discounted monthly rate per pack, times number of packs)
5. Total monthly equivalent
6. Total annual / total contract price
7. Savings vs current spend (or cost increase if applicable)

Tell the user: **"Renewal options generated. Review the pricing above and use it for your renewal conversation."**

---

### Step 9: Generate HTML Document

After displaying the renewal options text output, generate a polished HTML document that consolidates all the data from Steps 5-8 into a visual format CSMs can screenshot or print to PDF.

Tell the user: **"Generating HTML report..."**

**Build a complete HTML string** using the data already collected in the prior steps. The HTML must be fully self-contained — all CSS in a `<style>` tag, no external stylesheets, no JavaScript dependencies.

**HTML Structure — include these sections in order:**

**1. Header**

Show the company name as a large heading, with customer tier, date generated, and shop ID(s) as secondary info below it.

**2. Warning Banners (conditional)**

If Step 4 produced any warnings (missing seats, uncertain UGC limit, workspace issues), render each warning as a yellow/amber banner block at the TOP of the document body, before any data sections. Each warning gets its own banner line. Style: amber/yellow background (#FEF3C7), dark amber text (#92400E), left border accent, padding. If there are no warnings, omit this section entirely — do not render an empty container.

**3. Current State Baseline**

Render the customer's current state as a clean data grid:
- Current plan name and monthly/annual price (from Step 5)
- UGC usage: used / limit with utilization percentage (from Step 5)
- Active seats count (from Step 5)
- Workspace count (number of shop IDs from Step 2)

Use a card-style container with label-value pairs. Monetary values formatted with dollar signs and comma separators.

**4. Utilization Insight**

A single highlighted callout box with the utilization classification. Determine the classification from the utilization percentage calculated in Step 5:

- **Overpaying** (utilization < 40%): Green-tinted box. Text: "This customer is paying $[current_monthly]/mo but only using [utilization]% of their [ugc_total] UGC allocation. They are spending approximately $[wasted_amount]/mo on unused capacity." Calculate wasted_amount as: `current_monthly * (1 - utilization/100)`, rounded to nearest dollar.
- **Well-matched** (utilization 40-85%): Blue-tinted box. Text: "Usage aligns well with the current plan. The customer is using [ugc_used] of [ugc_total] UGC ([utilization]%). Room to grow without immediate upgrade pressure."
- **Ceiling risk** (utilization > 85%): Red-tinted box. Text: "This customer is using [ugc_used] of [ugc_total] UGC ([utilization]%). They are approaching or exceeding plan limits. Proactive upgrade conversation recommended to avoid overage disruption."

Color coding:
- Overpaying: background #F0FDF4, border #16A34A, text #166534
- Well-matched: background #EFF6FF, border #3B82F6, text #1E40AF
- Ceiling risk: background #FEF2F2, border #DC2626, text #991B1B

**5. Optimal Plan Calculation**

Render the comparison table from Step 7 as an HTML table:
- Columns: Plan, Base Price, UGC Limit, Add-on Packs, Add-on Cost, Total Monthly
- Rows: Startup, Growth, Enterprise
- Highlight the optimal (cheapest) row with a subtle green background (#F0FDF4)
- Below the table, show the optimal selection: "Optimal: [Plan Name] + [N] UGC add-on pack(s) = $[total]/mo"
- If high-usage warning (>15,000 UGC) was triggered in Step 7, show it as an amber note below the table

**6. Renewal Option Cards**

Render one card per option from Step 8. Each card is a bordered container with:
- Card header: option name (e.g., "Option 1: Annual Commitment")
- Plan name and base price (showing discount: "Growth @ $1,350/mo (10% off $1,500)")
- Add-on packs and price (e.g., "2 packs @ $225/mo each (10% off $250)")
- Total monthly equivalent (large, bold)
- Total annual / contract price
- Savings vs current: green text if saving money, red text if cost increase

If the customer is already optimal (Step 8 detected this), show a single card with the "already optimal" message and only the 2-year lock-in option.

Card styling: white background, 1px solid #E2E8F0 border, border-radius 8px, subtle shadow (0 1px 3px rgba(0,0,0,0.1)), padding 24px. Stack cards vertically with 16px gap.

**7. Footer**

Light gray text at the bottom: "Generated by /scale on [YYYY-MM-DD] | Internal use only — not for client distribution"

**Styling requirements (in the `<style>` tag):**

```
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Body: max-width 800px, margin 0 auto, padding 40px 24px, background #FAFAFA, color #1E293B
- Headings: #0F172A, font-weight 600
- Cards/sections: background #FFFFFF, border 1px solid #E2E8F0, border-radius 8px, padding 24px, margin-bottom 16px, box-shadow 0 1px 3px rgba(0,0,0,0.1)
- Tables: width 100%, border-collapse collapse, th background #F8FAFC, td/th padding 10px 14px, border-bottom 1px solid #E2E8F0
- Labels: font-size 13px, color #64748B, text-transform uppercase, letter-spacing 0.05em
- Values: font-size 16px, font-weight 500, color #1E293B
- Savings positive: color #16A34A
- Savings negative (cost increase): color #DC2626
- Print media query (@media print): background white, no shadows, no box-shadow, page-break-inside avoid on cards, hide footer "Generated by" line or make it smaller
```

**File output — after building the HTML string:**

1. Sanitize the company name for the filename: lowercase, replace spaces with hyphens, remove any characters that are not alphanumeric or hyphens
2. Generate the filename: `scale_[sanitized_company]_[YYYY-MM-DD].html`
3. Write the file to `~/Downloads/[filename]` using the Write tool
4. Open it in the default browser: run `open ~/Downloads/[filename]`
5. Tell the user: **"HTML report saved to ~/Downloads/[filename] and opened in your browser."**
