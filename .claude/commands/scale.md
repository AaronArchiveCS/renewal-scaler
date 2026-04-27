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

### Step 3: Data Fetch

<!-- DATA FETCH STEPS — added by Plan 01-02 -->

This step will be populated in the next plan. For now, summarize the confirmed identity:

```
--- Identity Confirmed ---
Company: [Company Name]
HubSpot ID: [record ID]
Tier: [customer_tier]
Lifecycle: [lifecyclestage]
ARR: [arr__active_deals_]
Shop IDs: [comma-separated list of all scoped shop IDs]
Workspace Count: [N]
---

Identity resolution complete. Data fetch steps will be added in the next update.
```
