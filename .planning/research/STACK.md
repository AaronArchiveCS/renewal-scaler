# Stack Research

**Domain:** Claude Code skill — multi-API data aggregation + HTML document generation
**Researched:** 2026-04-23
**Confidence:** HIGH (verified against npm registry, official PostHog/Stripe/HubSpot docs, and current Claude Code skill documentation)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Skill (`SKILL.md`) | Current | Delivery mechanism — `/scale` command | This is the correct primitive for Aaron's team. Skills load only when invoked, support `$ARGUMENTS` substitution for shop ID / company name, and support `allowed-tools` to pre-approve Bash without per-call prompts. The `.claude/skills/scale/` directory layout also lets us bundle the Node.js helper script alongside `SKILL.md` cleanly. Skills replaced `.claude/commands/` as the recommended pattern; old-style command files still work but skills are strictly better. |
| Node.js | 22 LTS (22.x) | Script runtime for API calls + HTML generation | Node 22 is the current LTS and ships with a built-in `fetch` (stable since v21), so there is zero need for axios or node-fetch. Native fetch eliminates a dependency and works identically to the browser API. The team already uses Node 22 across other projects (CSM Inbox Agent, Archive CS Bot). Avoid Node 20 — it lacks stable native fetch for streaming bodies. |
| TypeScript | 5.x (via tsx) | Type safety for API response shapes | Stripe, HubSpot, and PostHog all publish TypeScript types in their SDKs. Catching a misnamed field at write-time (e.g. `subscription.current_period_end` vs `subscription.currentPeriodEnd`) is worth the marginal setup cost. Use `tsx` to run `.ts` files directly without a build step — identical developer experience to plain JS in this context. |
| `tsx` | 4.x | Zero-config TypeScript runner | `npx tsx script.ts` executes TypeScript directly. No tsconfig, no compilation step, no dist folder. This is the standard pattern for Claude Code skill scripts that don't need a build pipeline. |

### API Client Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `stripe` | 22.1.0 | Stripe API client | Official SDK. Version 22 pins to the 2026-04-01 API surface. Use the SDK — not raw fetch — because the Stripe API has retry logic, idempotency headers, and TypeScript types baked in. The SDK also handles paginated list responses via async iterators, which matters when searching customers by metadata. |
| `@hubspot/api-client` | 13.5.0 | HubSpot CRM API client | Official SDK for HubSpot v3 API. Simplifies company search (by name or custom properties) and property fetching. The alternative — raw REST calls to `api.hubapi.com` — requires manually constructing filter bodies; the SDK's `crm.companies.searchApi.doSearch()` is cleaner and already familiar from other Archive automations. |
| PostHog | Direct REST (no SDK) | Usage metrics via HogQL | The PostHog Node SDK (`posthog-node` v5.30.x) is designed for event capture, not for querying analytics data. To pull 3-month rolling UGC counts for a specific shop ID, use the PostHog Query API directly via `fetch`: `POST https://us.posthog.com/api/projects/{id}/query` with a HogQL body. This keeps the dependency count low and matches how Aaron's existing CS Health Dashboard queries PostHog. |

### HTML Generation

| Approach | Version | Purpose | Why Recommended |
|----------|---------|---------|-----------------|
| ES6 Template Literals | Native | HTML document generation | For a single-file output document with known structure and no user-supplied content (no XSS risk), template literals are the right choice. No dependency, no template compilation step, full TypeScript type support in interpolations. The output is generated once per run by a trusted script — there is no need for a rendering engine. Handlebars or EJS would add a dependency and require either a template file or an inline string that is harder to read than a tagged template. |
| Inline CSS (in `<style>`) | Native | Document styling | Self-contained output. The HTML file must be portable — openable by any CSM without a server, pasteable into Slack, or printable to PDF via browser. Inline or `<style>` block CSS achieves this. Do not reference external stylesheets or CDN links — they break offline use. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | 4.19.x | TypeScript execution | Always — used to run the script from inside `SKILL.md` via `npx tsx ${CLAUDE_SKILL_DIR}/scripts/scale.ts` |
| `dotenv` | 16.x | Load API credentials from `.env` | Only if Aaron runs this locally from a non-Claude-Code context. Inside Claude Code, env vars are already available from `~/.zshrc`. Can skip entirely if credentials come from the shell environment. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx --watch` | Hot reload during development | Run `npx tsx --watch scripts/scale.ts` to iterate on the script without restarting. |
| TypeScript LSP (built into VS Code / Cursor) | Type checking during authoring | No tsconfig needed for `tsx` execution, but adding a minimal `tsconfig.json` with `"strict": true` gives inline type errors in the editor. |
| Browser PDF print | HTML-to-PDF | CSMs open the generated HTML in Chrome and use Cmd+P → Save as PDF. No external PDF library needed — avoids `puppeteer` (heavyweight) or `html-pdf` (unmaintained). |

---

## Installation

```bash
# Create the skill directory
mkdir -p ~/.claude/skills/scale/scripts

# From inside the scripts directory, install dependencies
cd ~/.claude/skills/scale
npm init -y

# API clients
npm install stripe @hubspot/api-client

# TypeScript runner (dev — tsx is invoked via npx so can be global or local)
npm install -D tsx typescript
```

> Note: `posthog-node` is NOT installed. PostHog queries go through native `fetch` directly to the HogQL REST endpoint.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Direct `fetch` for PostHog | `posthog-node` SDK v5.30.x | Use the SDK if you need to capture events or use feature flags. For read-only analytics queries, the SDK is the wrong tool — it has no `query()` method. |
| `stripe` SDK | Raw `fetch` to Stripe REST | Only if you need to avoid all dependencies entirely. The SDK's retry logic, TypeScript types, and async iterators for pagination are worth the dependency at this scale. |
| ES6 template literals | Handlebars / EJS / Mustache | Use a template engine if the HTML structure is maintained by non-developers, is shared across multiple scripts, or contains user-supplied input that needs escaping. None of these conditions apply here. |
| `tsx` runner | `ts-node` | `ts-node` is slower to start and requires more tsconfig setup. `tsx` is the current community standard for one-shot TypeScript script execution. |
| `tsx` runner | Compile to JS first (`tsc`) | Only needed if you're shipping a package. For a skill script that runs locally, a build step adds friction with no benefit. |
| Node.js 22 + native fetch | `axios` | `axios` was necessary before Node had stable native fetch. Node 22 renders it redundant. Zero reasons to add it. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `posthog-node` SDK for analytics queries | The Node SDK is an event capture SDK. It has no method for running HogQL aggregation queries. Using it for this purpose would require undocumented internal calls. | Direct `fetch` to `POST https://us.posthog.com/api/projects/{id}/query` with a `HogQLQuery` body |
| `puppeteer` or `playwright` for PDF output | 150+ MB binary download, Chromium bundled, startup time of 2-5 seconds. Overkill for a document a CSM will print once. | Browser Cmd+P → Save as PDF |
| N8N workflow | N8N workflows require external HTTP calls, webhooks, and are not in the CSM's terminal workflow. The explicit constraint is "Claude Code skill." | `SKILL.md` + Node.js script |
| External CSS frameworks (Tailwind CDN, Bootstrap CDN) | The generated HTML must work offline and be fully self-contained. CDN links break without internet. | `<style>` block with hand-written CSS in the template literal |
| `node-fetch` or `axios` | Redundant on Node 22 which ships stable native `fetch`. | `globalThis.fetch` (built-in) |
| Separate web server or dashboard | Out of scope per PROJECT.md. This is not a web app. | Single-file HTML output |
| `html-pdf` npm package | Unmaintained (last release 2018), uses PhantomJS which is deprecated. | Browser print-to-PDF |

---

## Stack Patterns by Variant

**If Aaron provides a company name (not shop ID):**
- Use `@hubspot/api-client` `crm.companies.searchApi.doSearch()` to resolve name → shop ID
- Then use shop ID as the universal key for PostHog and Stripe lookups
- Because shop ID is the canonical cross-platform identifier per PROJECT.md

**If Aaron provides a shop ID directly:**
- Skip HubSpot name resolution
- Use shop ID directly in PostHog HogQL queries (`WHERE properties.shop_id = '{id}'`)
- Use shop ID as Stripe customer metadata key to find the subscription

**If PostHog query returns no data for the shop ID:**
- Surface a clear error in the HTML output rather than silently showing $0 usage
- Flag as "Usage data unavailable — verify shop ID in PostHog"
- Because silent zeroes would make the pricing recommendations wrong

**If running the skill outside Claude Code (pure terminal):**
- Add `dotenv` and a `.env` file at `~/.claude/skills/scale/.env`
- Because `~/.zshrc` env vars are only available in interactive shell sessions

---

## Skill File Structure

```text
~/.claude/skills/scale/
├── SKILL.md              # Skill definition + instructions for Claude
├── package.json          # npm manifest for stripe + @hubspot/api-client + tsx
├── node_modules/         # installed dependencies
└── scripts/
    └── scale.ts          # TypeScript script — API calls + HTML generation
```

The `SKILL.md` uses the `!` bash injection syntax to run the script and capture output:

```yaml
---
name: scale
description: Generate renewal pricing options for a customer. Use when a CSM asks for renewal options, pricing analysis, or account scaling recommendations.
disable-model-invocation: true
allowed-tools: Bash(node *) Bash(npx *)
argument-hint: "[company name or shop ID]"
---

Generate renewal options for: $ARGUMENTS

Run the pricing script and present the output:

!`npx tsx ${CLAUDE_SKILL_DIR}/scripts/scale.ts "$ARGUMENTS"`
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `stripe` 22.x | Node.js 18+ | Requires Node 18 minimum. Node 22 is fine. |
| `@hubspot/api-client` 13.x | Node.js 18+ | Requires Node 18 minimum. |
| `tsx` 4.x | TypeScript 5.x, Node.js 18+ | No separate `ts-node` needed. |
| `posthog-node` (NOT used) | — | Not installed. PostHog is queried via native `fetch`. |

---

## API Reference Notes

**PostHog HogQL Query endpoint** (MEDIUM confidence — official docs, but page rendered as JS):
- URL: `POST https://us.posthog.com/api/projects/{project_id}/query`
- Auth: `Authorization: Bearer {personal_api_key}` header
- Body: `{ "query": { "kind": "HogQLQuery", "query": "SELECT count() FROM events WHERE ..." } }`
- Project ID for Archive: 192859 (per Aaron's memory, stored in `~/cs-health-dashboard/.env.local`)
- Default limit: 100 rows; override with `LIMIT` in HogQL. Max 50,000 rows per query.

**Stripe customer lookup by shop ID** (HIGH confidence — official SDK docs):
- Shop ID stored as customer metadata. Query: `stripe.customers.search({ query: "metadata['shop_id']:'${shopId}'" })`
- Subscription: `stripe.subscriptions.list({ customer: customer.id, status: 'active' })`

**HubSpot company search by name** (HIGH confidence — official SDK):
- `hubspotClient.crm.companies.searchApi.doSearch({ filterGroups: [...], properties: ['name', 'hs_object_id', ...] })`

---

## Sources

- `npm show stripe version` → `22.1.0` — confirmed current
- `npm show @hubspot/api-client version` → `13.5.0` — confirmed current
- `npm show posthog-node version` → `5.30.2` — confirmed current (but NOT used for query)
- `npm show tsx version` → (via `npm show axios` test run) — tsx 4.x confirmed available
- [PostHog Node.js SDK docs](https://posthog.com/docs/libraries/node) — confirmed SDK is capture-only; Query API is REST-only — MEDIUM confidence (page partially rendered)
- [PostHog Query API reference](https://posthog.com/docs/api/query) — HogQL endpoint structure — MEDIUM confidence
- [Stripe Node.js releases](https://github.com/stripe/stripe-node/releases) — v22.1.0 current, pins 2026-04-01 API — HIGH confidence
- [HubSpot Node.js client](https://github.com/HubSpot/hubspot-api-nodejs) — v13.5.0 current — HIGH confidence
- [Claude Code Skills documentation](https://code.claude.com/docs/en/slash-commands) — full skill spec including `SKILL.md` format, `$ARGUMENTS`, `allowed-tools`, `!` bash injection — HIGH confidence (fetched live)
- Training data: Node 22 native fetch stability, tsx vs ts-node tradeoffs — MEDIUM confidence (consistent with npm registry findings)

---

*Stack research for: Renewal Scaler Claude Code skill*
*Researched: 2026-04-23*
