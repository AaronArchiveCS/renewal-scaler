# Phase 1: Data Layer - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve customer identity across HubSpot, Stripe, and PostHog, then return a validated data profile with usage, plan, and billing information. The CSM runs `/scale [name or shop ID]` and gets back a confirmed customer profile with all fields needed for the pricing engine in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Identity Resolution
- **D-01:** Name search goes to HubSpot only. Once a company is confirmed, use the shop ID from HubSpot to cross-reference Stripe and PostHog.
- **D-02:** When multiple companies match a name search, show a numbered list (max 5) with key details (name, shop ID, plan). If >5 matches, ask the CSM to re-run with a shop ID.
- **D-03:** When CSM provides a shop ID directly, always confirm the match — show resolved company name and ask "Is this [Company Name]?" before proceeding.
- **D-04:** CSM selects one HubSpot company record. Tool extracts all shop IDs from that record's shop ID field. Then asks the CSM: "Does this customer have other workspaces we should include?" — CSM can add additional shop IDs manually.

### Data Source Mapping
- **D-05:** UGC limit source of truth is Stripe (billing system) — pull from subscription metadata or product details.
- **D-06:** UGC usage (3-month rolling average) comes from PostHog.
- **D-07:** Active seats come from PostHog — count distinct users with activity.
- **D-08:** Current plan name and pricing (monthly and annual) come from Stripe.
- **D-09:** Workspace = shop ID. One customer can have multiple shop IDs (e.g., L'Oreal has Garnier, Maybelline as separate shops; agencies have multiple client brands). Most single-brand customers are 1:1.
- **D-10:** Shop ID field on HubSpot companies can contain multiple IDs in a single field. Format TBD — must check HubSpot to determine delimiter. Some customers also have separate HubSpot company records per brand.
- **D-11:** For multi-workspace customers, aggregate data across ALL shop IDs from the selected company record plus any additional IDs the CSM provides.
- **D-12:** Usage trend calculated month-over-month — compare each of the last 3 months sequentially. If 2 out of 3 months are increasing, classify as "growing." Same logic for declining. Otherwise "stable."

### Missing Data Handling
- **D-13:** Hard-stop on critical fields: plan name, current price, and UGC usage. If any are missing or null, stop and surface an explicit error. Secondary fields (seats, workspaces) warn and continue.
- **D-14:** Error messages include the field name AND where to fix it (e.g., "Missing: UGC limit — check Stripe subscription metadata for shop_12345"). Actionable, not just informative.
- **D-15:** If any API (PostHog, Stripe, HubSpot) is down or times out, fail fast with a clear message naming which system is unreachable. No silent retries — CSM can re-run when ready.

### Skill UX & Output
- **D-16:** Step-by-step progress updates during data fetch: "Fetching PostHog usage... done. Fetching Stripe billing... done." Keeps CSM informed during the wait.
- **D-17:** Phase 1 standalone output is a structured text summary with all fields: company name, plan, price, UGC usage/limit, seats, workspaces, trend. Readable in the terminal.
- **D-18:** No extra flags for v1 — just `/scale [name or shop ID]`. Add flags later if CSMs request them.

### Claude's Discretion
- Exact PostHog queries for UGC usage aggregation and distinct user counting
- How to structure the internal data object that Phase 2 will consume
- Progress update formatting and timing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above. The following project docs provide additional context:

### Project Context
- `.planning/PROJECT.md` — Project vision, constraints, open items (HubSpot field names, pricing doc)
- `.planning/REQUIREMENTS.md` — Full v1 requirements with traceability to phases

### Open Items (blockers to resolve during research/planning)
- HubSpot shop ID field name and multi-value format — must inspect HubSpot to confirm
- Stripe MCP availability in Claude Code — fallback pattern needed if unavailable
- HubSpot custom property name for any additional fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — greenfield project. Skill will be created as a Claude Code command.

### Established Patterns
- This is a Claude Code skill (`/scale`) — follows the standard skill file pattern in `~/.claude/commands/`
- PostHog, Stripe, and HubSpot APIs are all accessible from existing MCP integrations in Claude Code

### Integration Points
- Skill entry point: `~/.claude/commands/scale.md` (or project-local `.claude/commands/`)
- MCP tools: PostHog MCP, HubSpot MCP, Stripe MCP (availability TBD)
- Phase 2 will consume the validated data profile produced by this phase

</code_context>

<specifics>
## Specific Ideas

- L'Oreal is a key example of a multi-workspace customer: Garnier Paris, Garnier, Maybelline are all separate shop IDs rolling up under L'Oreal
- Agencies are another multi-workspace pattern: marketing companies with multiple client brands, each having their own shop ID
- CSM team: Emanuel, Andres, Valentina, Natalia — internal audience only

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-layer*
*Context gathered: 2026-04-24*
