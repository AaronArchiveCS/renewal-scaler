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

Is the client adding new workspaces for this renewal? If yes, enter the additional shop IDs separated by commas. If no, type "no" to continue.
```

**Wait for the CSM's response.**

- If they provide additional shop IDs, add them to the list.
- If they say "no" (or similar), proceed with just the extracted IDs.

Tell the user: **"Workspace scope confirmed: [N] shop ID(s)."**

Store the final list of shop IDs for use in Step 3.

### Step 3: Parallel Data Fetch

Now fetch usage and billing data from PostHog and Stripe simultaneously. Use the shop ID list from Step 2 for all queries.

---

**3A: Retool — UGC Usage (from production database)**

Tell the user: **"Fetching UGC usage from production database (Retool)..."**

Query the Archive production read replica via Retool to get actual UGC counts. The Retool resource ID is `2d92127b-9465-461d-ab9d-be914f69c9b9` (Archive / Prod / Read replica). The global variable name is `archiveProdReadReplica`.

First, call `mcp__retool__retool_get_resource_typescript_definitions` with `resourceIds: ["2d92127b-9465-461d-ab9d-be914f69c9b9"]` to initialize bindings.

Then, call `mcp__retool__retool_execute_resource_typescript` with this code (replace `SHOP_IDS` with the actual shop ID list from Step 2 as a comma-separated string for the SQL IN clause):

```typescript
const shopIds = [SHOP_ID_1, SHOP_ID_2]; // from Step 2, as numbers
const now = new Date();
const currentMonthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
const sixMonthsAgo = new Date(now);
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
const sixMonthStart = `${sixMonthsAgo.getUTCFullYear()}-${String(sixMonthsAgo.getUTCMonth() + 1).padStart(2, '0')}-01`;

const results = await Promise.all(shopIds.map(async (sid) => {
  const [currentMonth, sixMonthTotal, allTime, shopInfo] = await Promise.all([
    archiveProdReadReplica(
      "SELECT COUNT(*) as ugc_count FROM shop_items WHERE shop_id = $1 AND deleted_at IS NULL AND created_at >= $2",
      [sid, currentMonthStart]
    ),
    archiveProdReadReplica(
      "SELECT COUNT(*) as ugc_count FROM shop_items WHERE shop_id = $1 AND deleted_at IS NULL AND created_at >= $2 AND created_at < $3",
      [sid, sixMonthStart, currentMonthStart]
    ),
    archiveProdReadReplica(
      "SELECT COUNT(*) as ugc_count FROM shop_items WHERE shop_id = $1 AND deleted_at IS NULL",
      [sid]
    ),
    archiveProdReadReplica(
      "SELECT shop_name FROM public.shops WHERE id = $1",
      [sid]
    )
  ]);
  return {
    shop_id: sid,
    shop_name: shopInfo.data[0]?.shop_name,
    current_month_ugc: Number(currentMonth.data[0].ugc_count),
    prior_6mo_ugc: Number(sixMonthTotal.data[0].ugc_count),
    six_month_avg_monthly_ugc: Math.round(Number(sixMonthTotal.data[0].ugc_count) / 6),
    all_time_active_ugc: Number(allTime.data[0].ugc_count)
  };
}));
return results;
```

Use `resourceIds: ["2d92127b-9465-461d-ab9d-be914f69c9b9"]` for the execute call.

From the results, extract per shop ID and then sum for multi-workspace customers:

- **UGC Used (current month)**: `current_month_ugc` — items created this billing month. For multi-workspace, sum across all shop IDs.
- **UGC Used (6-month avg)**: `six_month_avg_monthly_ugc` — average monthly UGC ingest over prior 6 months. This is the primary metric for renewal pricing (smooths variance like we do with Stripe MRR). For multi-workspace, sum across all shop IDs.
- **All-Time Active UGC**: `all_time_active_ugc` — total non-deleted items. Show as supplementary context.

**For renewal pricing calculations (Steps 7-8), use the 6-month average as the UGC usage number** — it's the most reliable indicator of ongoing consumption, consistent with how MRR is calculated from 6-month invoice averages.

The PostHog `pricing_ugc_total` value is still used as the **UGC Limit** (plan allowance). Fetch it alongside in a parallel PostHog query:

Use `mcp__claude_ai_PostHog__query-run` with:
```json
{
  "query": {
    "kind": "HogQLQuery",
    "query": "SELECT key AS shop_id, JSONExtractFloat(properties, 'pricing_ugc_total') AS ugc_total, JSONExtractFloat(properties, 'pricing_credits_used') AS credits_used, JSONExtractFloat(properties, 'pricing_credits_total') AS credits_total FROM groups WHERE key IN ('{shop_id_1}', '{shop_id_2}') LIMIT 10"
  }
}
```

- **UGC Limit**: `pricing_ugc_total` from PostHog groups table. For multi-workspace, sum.
- **Utilization %**: `6_month_avg_ugc / ugc_total * 100`, rounded to nearest integer.
- **Credits Used / Credits Total**: If non-zero, include as supplementary data.

If the Retool query returns 0 for `all_time_active_ugc` for a shop ID, warn: "Shop ID [id] has no active items in the production database — verify it exists."

Tell the user: **"Production UGC data... done."**

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

**3C: Stripe — Plan, Pricing, and MRR/ARR (Invoice-Based)**

Tell the user: **"Fetching Stripe billing data..."**

**IMPORTANT:** Customers may have multiple Stripe customer IDs (e.g., a legacy account and a current one). Always search by company name to find ALL customer records, then use the one with the most recent paid invoices.

**Step 3C-1: Find all Stripe customer records**

First, ALWAYS search Stripe by company name to find all customer records:

```
mcp__claude_ai_Stripe__search_stripe_resources
  query: "customers:name~'<company_name>'"
```

Also check if the HubSpot company record has a `stripe_customer_id` property. If it does, add it to the list of customer IDs to check.

Collect ALL unique Stripe customer IDs found.

**Step 3C-2: Pull invoices for each customer ID**

For EACH Stripe customer ID found, pull the last 12 invoices:

```
mcp__claude_ai_Stripe__list_invoices
  customer: "<customer_id>"
  limit: 12
```

**Step 3C-3: Select the correct customer ID**

The correct customer ID is the one with the most recent **paid** invoices (`status: "paid"`). If multiple IDs have recent invoices, prefer the one with larger `amount_paid` values (the real billing account, not a legacy stub).

Tell the user which Stripe customer ID was selected and note if multiple were found:
> Stripe customer: [selected_id] (found [N] customer record(s) — using the one with most recent billing activity)

**Step 3C-4: Calculate MRR and ARR from actual invoices**

Using the selected customer's invoices, calculate MRR based on what the customer has actually paid — not the subscription price, which may be stale or on the wrong customer record.

1. Take the last 6 **paid** invoices (status: "paid") from the selected customer
2. Sum the `amount_paid` values (these are in cents — divide by 100)
3. **MRR** = 6-month total / 6 (average monthly payment)
4. **ARR** = MRR × 12

Show the invoice breakdown to the user:
```
--- Invoice History (last 6 months) ---
[date]: $[amount]
[date]: $[amount]
...
6-month average: $[MRR]/mo
```

If fewer than 6 paid invoices exist, use however many are available and note it:
> WARNING: Only [N] paid invoices found. MRR based on [N]-month average.

**Step 3C-5: Get plan name from active subscription**

After selecting the correct customer ID, list their subscriptions:

```
mcp__claude_ai_Stripe__list_subscriptions
  customer: "<selected_customer_id>"
```

Get the product linked to the subscription's price. The subscription response contains `items.data[0].price.product` (a product ID). Fetch the full product:

```
mcp__claude_ai_Stripe__fetch_stripe_resources
  resource: "products/<product_id>"
```

The product `name` is the plan name.

**UGC limit:**

The UGC limit is retrieved from PostHog's `groups` table in Step 3A (`pricing_ugc_total`). UGC usage comes from the Retool production database (also Step 3A). No need to extract either from Stripe metadata.

Tell the user: **"Stripe billing data... done."**

---

### Step 4: Validation

After all data is fetched, validate the results before producing output.

**Critical fields — hard-stop if missing (per D-13):**

These fields are required. If any are null, missing, or could not be retrieved, **stop immediately** and show the error. Do NOT produce partial output.

- **Plan name:** If null or missing, stop and show:
  > MISSING: Plan name — could not find an active Stripe subscription for [Company Name]. Stripe customer: [stripe_id or "not found"]. Check Stripe manually and verify the customer has an active subscription.

- **MRR/ARR:** If no paid invoices were found for any Stripe customer ID, stop and show:
  > MISSING: MRR/ARR — no paid invoices found for [Company Name] across [N] Stripe customer ID(s) checked. Verify the customer has billing activity in Stripe.

- **UGC usage:** If the Retool production DB query returned an error or `all_time_active_ugc = 0` for all shop IDs, stop and show:
  > MISSING: UGC usage — Retool production DB query failed for shop_id(s) [ids]. Error: [error message]. Check if these shop IDs exist in the production database.

  Note: Zero current-month UGC with non-zero all-time UGC is a valid result (seasonal customer), NOT a missing field. Only hard-stop if the query itself errored or returned no rows for any shop ID.

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

> ERROR: [System name — HubSpot / PostHog / Stripe / Retool] is unreachable. Tool call failed: [error message]. Re-run `/scale` when the system is available.

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

--- Current Plan & Revenue ---
Plan:           [Plan name from Stripe product]
MRR:            $[6-month avg from invoices, formatted with commas]
ARR:            $[MRR × 12, formatted with commas]
Stripe Customer: [selected customer ID]

--- UGC Usage (from production database) ---
UGC This Month: [current_month_ugc]
UGC 6-Mo Avg:   [six_month_avg_monthly_ugc]/mo (used for pricing calc)
UGC All-Time:   [all_time_active_ugc] active items
UGC Limit:      [pricing_ugc_total from PostHog]
Utilization:    [six_month_avg / ugc_total * 100, rounded]%
Credits Used:   [pricing_credits_used] / [pricing_credits_total] (if non-zero, otherwise omit this line)

--- Seats ---
Active Seats:   [count] (last 90 days)

--- Warnings ---
[Any warning messages from Step 4, each on its own line. If no warnings, show: "None"]

Data collection complete. Calculating optimal pricing...
```

**Notes:**
- All monetary values should include dollar signs and comma separators (e.g., $1,200 not $1200).
- UGC usage data comes from the **Retool production database** (shop_items table) — the true source of truth. PostHog's `six_month_avg_monthly_ugc` in the groups table is unreliable (consistently underreports by 30-50%).
- The **6-month average** is used for pricing calculations, matching the methodology used for MRR (6-month invoice average).

---

### Step 5B: CSM Renewal Context

After showing the data profile, ask the CSM one question about UGC needs before proceeding to pricing:

```
Does the client need more UGC capacity for this renewal?
1. No — keep current usage as the baseline
2. Yes — I know the target (enter the desired UGC/mo threshold)
3. Yes — add a flat amount on top of current (e.g., +500, +1000)
4. Yes — increase by ___% from today's 6-month avg

Enter 1, 2, 3, or 4:
```

**Wait for the CSM's response.**

- **Option 1 (No):** Use `six_month_avg_monthly_ugc` from Step 5 as the UGC number for pricing. Proceed to Step 6.
- **Option 2 (Yes, known target):** Ask the CSM to enter the desired UGC/mo number. Use that number instead of `six_month_avg_monthly_ugc` for all pricing calculations in Steps 7-8. Show: "UGC target overridden: [new_target]/mo (was [six_month_avg]/mo from prod DB)."
- **Option 3 (Yes, flat increase):** Ask the CSM to enter the additional UGC amount. Calculate: `new_target = six_month_avg_monthly_ugc + flat_amount`. Use that for pricing. Show: "UGC target adjusted: [new_target]/mo ([six_month_avg] + [flat_amount] additional)."
- **Option 4 (Yes, % increase):** Ask the CSM to enter the % increase. Calculate: `new_target = six_month_avg_monthly_ugc * (1 + pct/100)`, rounded up. Use that for pricing. Show: "UGC target adjusted: [new_target]/mo (+[pct]% from [six_month_avg]/mo)."

Store the final UGC target for use in Steps 7-8.

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

1. Read `six_month_avg_monthly_ugc` from the Step 5 output (the UGC 6-Mo Avg value). This is the primary metric for pricing.

2. **Zero or null usage:** If `six_month_avg_monthly_ugc` is 0 or null (valid data, not a missing field), recommend Startup with 0 add-on packs at $500/mo. Skip to the output step below.

3. **For each base plan** (Startup, Growth, Enterprise), calculate:
   - UGC gap = `six_month_avg_monthly_ugc` - plan's UGC limit
   - If gap <= 0: packs needed = 0 (the plan covers all usage)
   - If gap > 0: packs needed = ceil(gap / 500)
   - Total monthly cost = plan's monthly price + (packs needed * $250)
   - Store: plan name, plan monthly price, UGC limit, packs needed, add-on monthly cost (packs * $250), total monthly cost

4. **Select the combination with the lowest total monthly cost.** If two combinations tie on cost, prefer the one with the higher-tier plan (it includes more credits).

5. **High usage warning:** If `six_month_avg_monthly_ugc` exceeds 15,000, still calculate the optimal combo but append this warning after the result:
   > NOTE: This customer uses [N] UGC/mo, which requires [X] add-on packs on top of Enterprise. Custom pricing may be more appropriate -- consult with leadership before presenting these options.

6. **Show the calculation breakdown:**

```
=== OPTIMAL PLAN CALCULATION ===

Customer UGC Usage: [six_month_avg_monthly_ugc]/mo (6-month avg from prod DB)

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

Compare the customer's current plan name (from Step 5) against the optimal plan name (from Step 7), and compare the customer's MRR (from Step 3C invoices) against the optimal annual-discounted monthly rate (within $50/mo tolerance to account for rounding). If BOTH match, the customer is already on the optimal plan at a competitive rate. In that case, show:

```
=== RENEWAL OPTIONS ===

This customer is already on the optimal plan ([Plan Name]) at a competitive rate.
Current: $[MRR]/mo MRR | Optimal annual: $[optimal_annual_monthly]/mo
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
- Customer's current ARR: from Step 3C invoice-based calculation (MRR × 12)
- Recommended annual spend: the annual contract price from the option
- Annual savings: `current_ARR - recommended_annual`
- If savings is negative (recommended costs MORE than current), show the increase amount and note it explicitly. Do not hide cost increases.

**No volume discounts, no loyalty discounts, no custom pricing.** Only the standard 10% annual and 20% 2-year discount rates apply.

**Output format -- present all three options as structured blocks:**

**Always generate Option A (Protect ARR) first** — this is the preferred approach. Options B and C show what usage-based pricing would look like for reference.

```
=== RENEWAL OPTIONS ===

Current spend: $[MRR]/mo MRR ($[ARR]/yr ARR) on [current_plan_name]
Optimal usage-based plan: [optimal_plan_name] + [N] UGC add-on pack(s) = $[optimal_monthly]/mo

--- Option A: Protect ARR — Current + 5% Increase (RECOMMENDED) ---
Current MRR:     $[MRR]/mo
New MRR (+5%):   $[MRR * 1.05, rounded to nearest dollar]/mo
Annual price:    $[new_MRR * 12]/yr
2-Year price:    $[new_MRR * 24]/yr
vs Current:      $[increase_amount]/yr increase

--- Option B: Usage-Based — Annual Commitment (10% off) ---
Base plan:       [Plan Name] @ $[discounted_monthly]/mo (10% off $[list_monthly])
UGC add-ons:     [N] pack(s) @ $[discounted_addon_monthly]/mo each (10% off $250)
Monthly total:   $[total_monthly]
Annual price:    $[annual_total]
vs Current:      $[savings]/yr [savings | increase]

--- Option C: Usage-Based — 2-Year Commitment (20% off) ---
Base plan:       [Plan Name] @ $[discounted_monthly]/mo (20% off $[list_monthly])
UGC add-ons:     [N] pack(s) @ $[discounted_addon_monthly]/mo each (20% off $250)
Monthly total:   $[total_monthly]
Annual price:    $[annual_total]
2-Year total:    $[two_year_total]
vs Current:      $[savings]/yr [savings | increase]
```

**Option A calculation:**
- Take the customer's current MRR from Step 3C (invoice-based)
- Apply a 5% increase: `new_MRR = MRR * 1.05`, rounded to nearest dollar
- Annual: `new_MRR * 12`
- 2-Year: `new_MRR * 24`
- This option keeps the customer on their current plan structure with a standard price increase — no plan migration needed

**Display fields per usage-based option (all 7 required):**
1. Base plan name (e.g., "Growth")
2. Base plan price (discounted monthly rate)
3. Number of UGC add-on packs (e.g., "2 packs")
4. Add-on price (discounted monthly rate per pack, times number of packs)
5. Total monthly equivalent
6. Total annual / total contract price
7. Savings vs current spend (or cost increase if applicable)

Tell the user: **"Renewal options generated. Option A (Protect ARR) is the recommended default. Options B and C show usage-based pricing for reference. Review and use for your renewal conversation."**

---

### Step 9: Generate Renewal Overview HTML

After displaying the renewal options text output, generate a polished, client-ready renewal proposal.

Tell the user: **"Generating Renewal Overview..."**

**How to generate:**

1. **Read the reference template** at `~/renewal-scaler/handoff/reference/Renewal Overview.html`. This is a complete, working, single-file HTML document with all CSS, React components, and the Tweaks panel already inlined. Do NOT read or use the separate `.jsx` files — everything is already in the reference HTML.

2. **Copy the entire reference HTML** and only change the `DATA` object and `TONE_COPY` text. Find the line that starts with `const DATA = {` and replace the values with the customer-specific data from Steps 1-8:

```javascript
const DATA = {
  customer: { name: "[Company Name]", generated: "[Month Day, Year]", contact: "[CSM name, or 'Aaron Rampersad, Head of CS']" },
  current: { plan: "Current Plan", planDetail: "[plan detail from Stripe]", mrr: [MRR], arr: [ARR], ugcLimit: [ugc_total from PostHog], seats: [active_seats], workspaces: [count] },
  recommended: { tier: "[Optimal plan from Step 7]", addOns: [packs], listMonthly: [undiscounted monthly] },
  packageFeatures: { /* use tier-specific list below */ },
  options: {
    annual: { term: "1-Year Commitment", basePrice: [discounted base], baseList: [list base], baseDiscount: 10, addOnPrice: [discounted addon], addOnList: 250, addOnPacks: [packs], monthly: [total monthly], annual: [monthly*12], savingsAnnual: [ARR - annual], savingsPct: [round(savings/ARR*100)] },
    twoYear: { term: "2-Year Commitment", basePrice: [discounted base], baseList: [list base], baseDiscount: 20, addOnPrice: [discounted addon], addOnList: 250, addOnPacks: [packs], monthly: [total monthly], annual: [monthly*12], contractTotal: [monthly*24], savingsAnnual: [ARR - annual], savingsPct: [round(savings/ARR*100)] }
  }
};
```

3. **Update TONE_COPY** — find all references to the customer name ("The Feed") and the recommended tier/packs ("Growth + 4 UGC packs") in the `TONE_COPY` object and replace with the actual customer name and recommended package.

4. **Update the `<title>` tag** to say `Renewal Overview — [Company Name]`.

5. **Package features by tier** — use these canonical lists for `packageFeatures`:

**Startup:** `{ name: "Startup", tagline: "For serious SMBs running gifting + creator discovery", ugcLimit: "500/mo", credits: "20,000/mo", features: ["Social Listening","Reports","Impressions + EMV","Campaigns","Creator Search","UGC Super Search",{name:"Competitor Insights",note:"discovery only"},"Whitelisting + Usage Rights","API Access"], creditsBased: ["Audience Data","Campaign Refresh"], addOns: ["UGC Packs","Credit Packs","Extra Competitors"] }`

**Growth:** `{ name: "Growth", tagline: "For mid-market teams scaling UGC + measurement", ugcLimit: "2,500/mo", credits: "70,000/mo", features: ["Social Listening","Reports","Impressions + EMV","Campaigns","Creator Search","UGC Super Search",{name:"Competitor Insights",note:"discovery + benchmarking"},"Whitelisting + Usage Rights","API Access"], creditsBased: ["Audience Data","Campaign Refresh","Deep Research","Archive Radar",{name:"Magic Fields",note:"up to 3"},"AI Sentiment Analysis"], addOns: ["UGC Packs","Credit Packs","Extra Competitors"] }`

**Enterprise:** `{ name: "Enterprise", tagline: "For advanced workflows, controls, and scale", ugcLimit: "10,000/mo", credits: "150,000/mo", features: ["Social Listening","Reports","Impressions + EMV","Campaigns","Creator Search","UGC Super Search",{name:"Competitor Insights",note:"discovery + benchmarking"},{name:"Whitelisting + Usage Rights",note:"custom terms"},"API Access"], creditsBased: ["Audience Data","Campaign Refresh","Deep Research","Archive Radar",{name:"Magic Fields",note:"up to 10+"},"AI Sentiment Analysis"], addOns: ["UGC Packs","Credit Packs","Extra Competitors"] }`

6. **Do NOT change anything else** — the CSS, React components, Tweaks panel, increase-mode logic, upfront discount, card visibility toggles, and all interactivity are already built into the reference HTML. Just swap the data.

**Rules for the rendered document:**
- No tier or shop ID in the meta row — only Customer, Prepared by, Date (+ Contract ends if set)
- No UGC usage averages, utilization %, or "overpaying" framing
- `current.plan` should say "Current Plan" (not internal Stripe names)
- The `recommended.tier` should always reference the actual plan name (Startup/Growth/Enterprise)

**File output:**

1. Generate the filename: `Renewal Overview - [Company Name].html`
2. Write the file to `~/Downloads/[filename]` using the Write tool
3. Open it in the default browser: run `open ~/Downloads/[filename]`
4. Tell the user: **"Renewal Overview saved to ~/Downloads/[filename] and opened in your browser. Click the ⚙ gear icon to open the Tweaks panel."**
