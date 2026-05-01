// Renewal Overview — proposal document
// Data is hard-coded for the demo; in production the skill renders these values.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tone": "polished",
  "density": "regular",
  "highlighted": "two_year",
  "showCurrentDetail": true
}/*EDITMODE-END*/;

// ── Source data (matches the input doc) ─────────────────────────────────────
const DATA = {
  customer: {
    name: "The Feed",
    generated: "April 30, 2026",
    contact: "Annie Chen, CSM",
  },
  current: {
    plan: "Custom Standard",
    planDetail: "CN5 5,000 UGC + API add-on",
    mrr: 2990,
    arr: 35880,
    ugcLimit: 15000,
    ugcAvg: 3780,
    ugcThisMonth: 3088,
    utilization: 25,
    seats: 10,
    workspaces: 1,
  },
  recommended: {
    tier: "Growth",
    addOns: 3,
    listMonthly: 2250,
  },
  // From the published pricing page — exact package names + features
  packageFeatures: {
    name: "Growth",
    tagline: "For mid-market teams scaling UGC + measurement",
    ugcLimit: "2,500/mo",
    credits: "70,000/mo",
    features: [
      "Social Listening",
      "Reports",
      "Impressions + EMV",
      "Campaigns",
      "Creator Search",
      "UGC Super Search",
      { name: "Competitor Insights", note: "discovery + benchmarking" },
      "Whitelisting + Usage Rights",
      "API Access",
    ],
    creditsBased: [
      "Audience Data",
      "Campaign Refresh",
      "Deep Research",
      "Archive Radar",
      { name: "Magic Fields", note: "up to 3" },
      "AI Sentiment Analysis",
    ],
    addOns: ["UGC Packs", "Credit Packs", "Extra Competitors"],
  },
  options: {
    annual: {
      term: "1-Year Commitment",
      basePrice: 1350, baseList: 1500, baseDiscount: 10,
      addOnPrice: 225, addOnList: 250, addOnPacks: 3,
      monthly: 2025,
      annual: 24300,
      savingsAnnual: 11580,
      savingsPct: 32,
    },
    twoYear: {
      term: "2-Year Commitment",
      basePrice: 1200, baseList: 1500, baseDiscount: 20,
      addOnPrice: 200, addOnList: 250, addOnPacks: 3,
      monthly: 1800,
      annual: 21600,
      contractTotal: 43200,
      savingsAnnual: 14280,
      savingsPct: 40,
    },
  },
};

// ── Tone copy variants ──────────────────────────────────────────────────────
const TONE_COPY = {
  polished: {
    eyebrow: "Renewal Overview",
    title: <>Your renewal,<br /><em>right-sized.</em></>,
    sub: "We've reviewed your account and built two paths forward — both at a meaningfully lower cost than your current plan.",
    summaryLead: (
      <>
        Based on a review of <strong>The Feed</strong>&rsquo;s account, the
        renewal options below align your plan to the right shape for your
        team&rsquo;s next term.
      </>
    ),
    recEyebrow: "Recommended tier",
    recText: (
      <>
        Based on usage patterns, <strong>Growth + 3 UGC packs</strong> is
        the right shape for The Feed&rsquo;s next term.
      </>
    ),
    recPill: "Growth Tier",
    signoff: "Prepared with care by your CSM.",
  },
  neutral: {
    eyebrow: "Renewal Overview",
    title: <>Renewal options<br /><em>for The Feed.</em></>,
    sub: "Two contract structures, priced for the next term.",
    summaryLead: (
      <>
        The options below resize <strong>The Feed</strong>&rsquo;s plan for
        the next term.
      </>
    ),
    recEyebrow: "Recommended tier",
    recText: (
      <>
        <strong>Growth + 3 UGC packs</strong> matches observed usage with
        appropriate headroom.
      </>
    ),
    recPill: "Growth Tier",
    signoff: "—",
  },
  advisory: {
    eyebrow: "A note on your renewal",
    title: <>Let&rsquo;s get you<br /><em>on the right plan.</em></>,
    sub: "We took a look at your account. Here's what we'd recommend, and what it would save you.",
    summaryLead: (
      <>
        Both renewal options below put <strong>The Feed</strong> on a tier
        that fits how your team works today.
      </>
    ),
    recEyebrow: "Our recommendation",
    recText: (
      <>
        We'd put you on <strong>Growth with 3 UGC packs</strong>. Same
        capabilities you have today, sized to how you actually work.
      </>
    ),
    recPill: "Growth Tier",
    signoff: "Happy to walk through any of this on a call.",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString("en-US");
const money = (n, opts = {}) => {
  const { decimals = 0 } = opts;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// ── Atom: hero amount ───────────────────────────────────────────────────────
function HeroAmount({ amount, period }) {
  return (
    <div className="hero-primary">
      <div className="hero-amount">
        <span className="currency">$</span>{money(amount)}
      </div>
      <div className="hero-period">{period}</div>
    </div>
  );
}

// ── Atom: hero trio (the three balanced numbers) ────────────────────────────
function HeroTrio({ items }) {
  return (
    <div className="hero-trio">
      {items.map((it, i) => (
        <div className="hero-trio-cell" key={i}>
          <div className="hero-trio-label">{it.label}</div>
          <div className={`hero-trio-value ${it.savings ? "savings" : ""}`}>
            {it.value}
          </div>
          {it.sub && <div className="hero-trio-sub">{it.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Option card ─────────────────────────────────────────────────────────────
function OptionCard({ data, featured, term, name, tag }) {
  const monthlyList = data.baseList + data.addOnList * data.addOnPacks;
  return (
    <div className={`option ${featured ? "featured" : ""}`}>
      {tag && (
        <div className={`option-tag ${featured ? "" : "muted"}`}>{tag}</div>
      )}

      <div className="option-head">
        <div className="option-name">{name}</div>
        <div className="option-term">{term}</div>
      </div>

      {/* Hero monthly */}
      <div className="hero-stack">
        <HeroAmount amount={data.monthly} period="per month" />
        <HeroTrio
          items={[
            {
              label: "Annual price",
              value: <>${money(data.annual)}</>,
              sub: data.contractTotal ? `$${money(data.contractTotal)} total` : null,
            },
            {
              label: "You save",
              value: <>${money(data.savingsAnnual)}</>,
              sub: "per year",
              savings: true,
            },
            {
              label: "Reduction",
              value: <>{data.savingsPct}%</>,
              sub: "vs current ARR",
              savings: true,
            },
          ]}
        />
      </div>

      {/* Line items */}
      <div className="lineitems">
        <div className="lineitem">
          <div>
            <div className="li-label">Growth base plan</div>
            <div className="li-sub">2,500 UGC included · {data.baseDiscount}% commitment discount</div>
          </div>
          <div className="li-amount">
            <span className="strike">${money(data.baseList)}</span>
            ${money(data.basePrice)}/mo
          </div>
        </div>
        <div className="lineitem">
          <div>
            <div className="li-label">UGC add-on packs × {data.addOnPacks}</div>
            <div className="li-sub">+1,500 UGC · {data.baseDiscount}% commitment discount</div>
          </div>
          <div className="li-amount">
            <span className="strike">${money(data.addOnList)}</span>
            ${money(data.addOnPrice)}/mo each
          </div>
        </div>
      </div>

      <div className="savings-callout">
        <div>
          <div className="sc-label">Annual savings</div>
        </div>
        <div className="sc-amount">${money(data.savingsAnnual)}</div>
      </div>
    </div>
  );
}

// ── Package features block ──────────────────────────────────────────────────
function FeatureItem({ item }) {
  const isObj = typeof item === "object";
  const name = isObj ? item.name : item;
  const note = isObj ? item.note : null;
  return (
    <li className="feat">
      <span className="feat-check" aria-hidden="true">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M2.5 6.2 L5 8.6 L9.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="feat-text">
        <span className="feat-name">{name}</span>
        {note && <span className="feat-note"> ({note})</span>}
      </span>
    </li>
  );
}

function PackageFeatures({ pkg }) {
  return (
    <div className="pkg">
      <div className="pkg-head">
        <div>
          <div className="pkg-name">{pkg.name}</div>
          <div className="pkg-tagline">{pkg.tagline}</div>
        </div>
        <div className="pkg-allowances">
          <div className="pkg-allow">
            <div className="pkg-allow-label">UGC Limit</div>
            <div className="pkg-allow-value">{pkg.ugcLimit}</div>
          </div>
          <div className="pkg-allow">
            <div className="pkg-allow-label">Credits</div>
            <div className="pkg-allow-value">{pkg.credits}</div>
          </div>
        </div>
      </div>

      <div className="pkg-cols">
        <div className="pkg-col">
          <div className="pkg-col-label">Features</div>
          <ul className="feat-list">
            {pkg.features.map((f, i) => (
              <FeatureItem key={i} item={f} />
            ))}
          </ul>
        </div>
        <div className="pkg-col">
          <div className="pkg-col-label">Credits-based</div>
          <ul className="feat-list">
            {pkg.creditsBased.map((f, i) => (
              <FeatureItem key={i} item={f} />
            ))}
          </ul>
        </div>
        <div className="pkg-col">
          <div className="pkg-col-label">Available add-ons</div>
          <ul className="feat-list feat-list-bullets">
            {pkg.addOns.map((f, i) => (
              <li key={i} className="feat feat-bullet">
                <span className="feat-name">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const copy = TONE_COPY[t.tone] || TONE_COPY.polished;

  React.useEffect(() => {
    document.body.dataset.density = t.density;
  }, [t.density]);

  const c = DATA.current;
  const annualHighlighted = t.highlighted === "annual";

  return (
    <>
      <div className="page">
        <div className="page-inner">

          {/* Brand */}
          <div className="brand">
            <div className="brand-mark">
              <div className="brand-glyph" aria-hidden="true"></div>
              <div className="brand-name">Archive</div>
            </div>
            <div className="brand-meta">
              For {DATA.customer.name} · {DATA.customer.generated}
            </div>
          </div>

          {/* Title */}
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1 className="doc-title">{copy.title}</h1>
          <p className="doc-sub">{copy.sub}</p>

          <div className="meta-row">
            <div className="meta-item">
              <div className="meta-label">Customer</div>
              <div className="meta-value">{DATA.customer.name}</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">Prepared by</div>
              <div className="meta-value">{DATA.customer.contact}</div>
            </div>
            <div className="meta-item">
              <div className="meta-label">Date</div>
              <div className="meta-value">{DATA.customer.generated}</div>
            </div>
          </div>

          {/* Section 01 — Current state */}
          <section className="section">
            <div className="section-head">
              <span className="section-num">01</span>
              <h2 className="section-title">Where you are today</h2>
              <span className="section-rule"></span>
            </div>

            <div className="current">
              <p className="current-summary">{copy.summaryLead}</p>

              {t.showCurrentDetail && (
                <div className="current-stats">
                  <div>
                    <div className="stat-label">Current plan</div>
                    <div className="stat-value">{c.plan}</div>
                  </div>
                  <div>
                    <div className="stat-label">Current MRR</div>
                    <div className="stat-value">${fmt(c.mrr)}<span className="unit"> /mo</span></div>
                  </div>
                  <div>
                    <div className="stat-label">Current ARR</div>
                    <div className="stat-value">${fmt(c.arr)}<span className="unit"> /yr</span></div>
                  </div>
                  <div>
                    <div className="stat-label">UGC limit</div>
                    <div className="stat-value">{fmt(c.ugcLimit)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Active seats</div>
                    <div className="stat-value">{c.seats}<span className="unit"> · 90d</span></div>
                  </div>
                  <div>
                    <div className="stat-label">Workspaces</div>
                    <div className="stat-value">{c.workspaces}</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Recommendation */}
          <section className="section">
            <div className="section-head">
              <span className="section-num">02</span>
              <h2 className="section-title">Our recommendation</h2>
              <span className="section-rule"></span>
            </div>

            <div className="recommendation">
              <div className="rec-text">
                <span className="rec-eyebrow">{copy.recEyebrow}</span>
                {copy.recText}
              </div>
              <div className="rec-pill">{copy.recPill}</div>
            </div>
          </section>

          {/* Package features */}
          <section className="section">
            <div className="section-head">
              <span className="section-num">03</span>
              <h2 className="section-title">What&rsquo;s included</h2>
              <span className="section-rule"></span>
            </div>

            <PackageFeatures pkg={DATA.packageFeatures} />
          </section>

          {/* Options */}
          <section className="section">
            <div className="section-head">
              <span className="section-num">04</span>
              <h2 className="section-title">Two ways to renew</h2>
              <span className="section-rule"></span>
            </div>

            <div className="options">
              <OptionCard
                data={DATA.options.annual}
                featured={annualHighlighted}
                name="Annual"
                term="1-Year Commitment"
                tag={annualHighlighted ? "Recommended" : "Option A"}
              />
              <OptionCard
                data={DATA.options.twoYear}
                featured={!annualHighlighted}
                name="Biennial"
                term="2-Year Commitment"
                tag={!annualHighlighted ? "Best value" : "Option B"}
              />
            </div>
          </section>

          {/* Footer */}
          <div className="doc-footer">
            <div className="signoff">{copy.signoff}</div>
            <div>
              Archive &nbsp;·&nbsp; Prepared {DATA.customer.generated} &nbsp;·&nbsp; Pricing valid 30 days
            </div>
          </div>

        </div>
      </div>

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Content">
          <TweakSelect
            label="Tone"
            value={t.tone}
            options={[
              { value: "polished", label: "Polished sales" },
              { value: "neutral", label: "Neutral summary" },
              { value: "advisory", label: "Friendly advisory" },
            ]}
            onChange={(v) => setTweak("tone", v)}
          />
          <TweakRadio
            label="Highlight"
            value={t.highlighted}
            options={[
              { value: "annual", label: "1-yr" },
              { value: "two_year", label: "2-yr" },
            ]}
            onChange={(v) => setTweak("highlighted", v)}
          />
          <TweakToggle
            label="Show full current-state stats"
            value={t.showCurrentDetail}
            onChange={(v) => setTweak("showCurrentDetail", v)}
          />
        </TweakSection>
        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            options={[
              { value: "compact", label: "Compact" },
              { value: "regular", label: "Regular" },
              { value: "comfy", label: "Comfy" },
            ]}
            onChange={(v) => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection label="Export">
          <TweakButton
            label="Print / Save as PDF"
            onClick={() => window.print()}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
