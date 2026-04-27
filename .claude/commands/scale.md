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

Data collection complete. Phase 2 will generate renewal pricing options.
```

**Notes:**
- This output format is for Phase 1 standalone use. Phase 2 will consume the same data programmatically to generate renewal pricing options.
- All monetary values should include dollar signs and comma separators (e.g., $1,200 not $1200).
- UGC data comes from PostHog's `groups` table (database source of truth), not the `events` table. The `events` table events like `crm.shop_item.created` only cover ~9 shops and are unreliable for UGC counts.
