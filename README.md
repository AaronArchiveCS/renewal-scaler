# Renewal Scaler

Generate renewal proposals for customer accounts.

## Setup (one time)

1. Clone this repo
2. Open Claude Code in this folder: `cd renewal-scaler && claude`
3. Enable MCP integrations when prompted (HubSpot, Stripe, PostHog, Retool)
4. Authenticate Retool when prompted on first run

## Usage

```
/scale [company name or shop ID]
```

Examples:
- `/scale The Feed`
- `/scale 88`

## What it does

1. Looks up the customer in HubSpot
2. Pulls UGC usage from the production database (Retool)
3. Pulls billing data from Stripe
4. Pulls seat count from PostHog
5. Calculates optimal plan + pricing options
6. Generates a polished Renewal Overview HTML with an interactive Tweaks panel

## The Tweaks panel

The HTML output includes a Tweaks panel (bottom-right gear icon) where you can:

- **Switch pricing mode**: Usage-based (shows savings) or Increase (flat % bump)
- **Adjust % per option**: Monthly, Annual, and 2-Year independently
- **Toggle pay-upfront discount** with adjustable %
- **Show/hide cards**: Monthly, Annual, 2-Year
- **Edit Prepared by** name and **Contract end date**
- **Toggle current-state stats**
- **Print / Save as PDF**
