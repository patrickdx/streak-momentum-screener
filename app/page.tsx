import Link from "next/link";
import { WEIGHTS } from "@/lib/momentum";
import { Arrow, Check } from "@/components/Icons";

const FACTORS = [
  {
    name: "Relative Strength",
    weight: WEIGHTS.relativeStrength,
    desc: "Return across one week, one month, three months and six months — weighted so recent action counts most without letting a single hot week outrank a half-year trend.",
  },
  {
    name: "Risk-Adjusted Return",
    weight: WEIGHTS.riskAdjusted,
    desc: "That same return divided by the stock's own volatility. A name that climbs steadily beats one that swings wildly to the same finish line.",
  },
  {
    name: "Streak Consistency",
    weight: WEIGHTS.consistency,
    desc: "How many separate stretches of the last six months were actually up. This is what separates a real streak from one explosive day.",
  },
  {
    name: "Trend Structure",
    weight: WEIGHTS.trendStructure,
    desc: "Where price sits against its 20-, 50- and 200-day averages, and how close it is to its 52-week high. Healthy trends stack in order.",
  },
  {
    name: "Volume Thrust",
    weight: WEIGHTS.volumeThrust,
    desc: "Whether volume is expanding as price rises. Money rotating in confirms a move; a quiet drift usually doesn't hold.",
  },
];

const SIGNALS = [
  { label: "52W High", cls: "chip-green", text: "Trading within 2% of its 52-week high." },
  { label: "Accelerating", cls: "chip-blue", text: "The last week's pace is more than double the prior two months." },
  { label: "Extended", cls: "chip-amber", text: "RSI above 80 or stretched 25%+ over its 20-day average. Strong, but a poor place to buy." },
  { label: "Pullback", cls: "chip-purple", text: "Cooling off while the bigger trend stays intact — often the more patient entry." },
  { label: "Vol Spike", cls: "chip", text: "Trading at more than twice its normal volume." },
];

export default function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <span className="eyebrow">
          Live data · US, Japan, Korea &amp; China · No signup
        </span>
        <h1>Find the stocks that are actually trending</h1>
        <p className="hero-sub">
          Most screeners sort by percentage gained, which floats takeover pops
          and one-day spikes straight to the top. Streak scores every liquid
          stock across four markets on five separate dimensions of momentum, so
          what you see is sustained strength — not noise that already happened.
        </p>
        <div className="hero-cta">
          <Link href="/screener" className="btn btn-primary btn-lg">
            Open the screener <Arrow />
          </Link>
          <a href="#how" className="btn btn-lg">See how it works</a>
        </div>
        <p className="hero-note">Free, no account needed. Quotes are delayed.</p>
      </section>

      <section className="section">
        <div className="section-label">The problem</div>
        <h2>A big number on one timeframe tells you almost nothing</h2>
        <p className="lead">
          Two stocks can both show <strong>+80% over one month</strong> and be
          completely different animals. Sorting by a single column can&rsquo;t
          tell them apart — but the shape of the move over time can.
        </p>
        <div className="compare">
          <div className="compare-card bad">
            <div className="compare-head">One-day pop</div>
            <div className="compare-body">
              Flat for months, then a takeover rumour gaps it 80% in a session.
              The move is over before you see it, and there&rsquo;s no trend
              underneath. A percentage-sorted screener ranks this first.
            </div>
          </div>
          <div className="compare-card good">
            <div className="compare-head">Real streak</div>
            <div className="compare-body">
              Up in each of the last four stretches, holding above its moving
              averages, near its 52-week high, on expanding volume. Same
              headline number, entirely different setup.
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-label">How it works</div>
        <h2>Five dimensions, scored against the whole market</h2>
        <p className="lead">
          Each stock is measured on five independent factors. Every factor is
          then ranked against <strong>every other liquid stock in its own
          market</strong> — so a score of 90 means top-decile of that entire
          market, not top-decile of a list already filtered down to winners.
        </p>
        <div className="factors">
          {FACTORS.map((f) => (
            <div className="factor" key={f.name}>
              <div className="factor-top">
                <span className="factor-name">{f.name}</span>
                <span className="factor-weight">{(f.weight * 100).toFixed(0)}%</span>
              </div>
              <div className="factor-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-label">The streak metric</div>
        <h2>Four windows, not one number</h2>
        <p className="lead">
          Standard return figures overlap — a single strong week inflates the
          1-month, 3-month and 6-month numbers all at once, so one good day can
          masquerade as six months of strength. Streak pulls them apart into
          four independent windows and checks each one separately.
        </p>
        <div className="streak-demo">
          <div className="streak-demo-row header">
            <div>Six months, split into four windows</div>
            <div className="window-bar">
              <span className="window flat">Months 4–6</span>
              <span className="window flat">Months 2–3</span>
              <span className="window flat">Weeks 2–4</span>
              <span className="window flat">Past week</span>
            </div>
          </div>
          <div className="streak-demo-row">
            <div>
              <div className="streak-demo-label">Real streak</div>
              <div className="streak-demo-note">Up in all four · 4 pips</div>
            </div>
            <div className="window-bar">
              <span className="window up">+18%</span>
              <span className="window up">+12%</span>
              <span className="window up">+9%</span>
              <span className="window up">+4%</span>
            </div>
          </div>
          <div className="streak-demo-row">
            <div>
              <div className="streak-demo-label">One-day pop</div>
              <div className="streak-demo-note">Same 6-month total · 1 pip</div>
            </div>
            <div className="window-bar">
              <span className="window flat">0%</span>
              <span className="window up">+48%</span>
              <span className="window down">−3%</span>
              <span className="window down">−2%</span>
            </div>
          </div>
        </div>
        <p className="lead" style={{ marginTop: 20 }}>
          In the screener this shows up as four small bars next to every stock.
          Four filled means it advanced in every window. Hover them to see each
          window&rsquo;s return.
        </p>
      </section>

      <section className="section">
        <div className="section-label">Four markets</div>
        <h2>The United States, Japan, South Korea and China</h2>
        <p className="lead">
          Each market is screened and scored <strong>separately</strong>, then
          the lists are merged. This matters more than it sounds: a percentile
          is a statement about a stock&rsquo;s peers, and Tokyo and New York can
          be in completely different regimes. Pooling them would let a flat
          month in a strong market outrank a good month in a weak one purely
          because of the company it was measured against.
        </p>
        <p className="lead">
          Prices stay in their local currency — yen, won, yuan — because that is
          what the market actually quotes. Market caps and the liquidity floor
          are converted to <strong>USD</strong>, so &ldquo;$1B and up&rdquo; and
          &ldquo;$10M a day&rdquo; mean the same thing in Seoul as in New York.
        </p>
        <div className="market-note-grid">
          {[
            { code: "US", label: "United States", detail: "NASDAQ, NYSE, AMEX" },
            { code: "JP", label: "Japan", detail: "Tokyo Stock Exchange" },
            { code: "KR", label: "South Korea", detail: "KRX" },
            { code: "CN", label: "China", detail: "Shanghai & Shenzhen A-shares" },
          ].map((m) => (
            <div className="market-note" key={m.code}>
              <span className="market-code">{m.code}</span>
              <div>
                <div className="market-note-label">{m.label}</div>
                <div className="market-note-detail">{m.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-label">Reading the results</div>
        <h2>Every row is tagged with what&rsquo;s happening</h2>
        <div className="legend-grid">
          {SIGNALS.map((s) => (
            <div className="legend-item" key={s.label}>
              <span className={`chip ${s.cls}`} style={{ cursor: "default", flex: "none" }}>
                {s.label}
              </span>
              <span className="legend-text">{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-label">What gets excluded</div>
        <h2>The universe is cleaned before anything is scored</h2>
        <p className="lead">
          Most of the junk that clutters momentum screens is filtered out before
          a single score is calculated.
        </p>
        <ul className="gate-list">
          <li><Check /><span><strong>Common stock only</strong> — no OTC listings, ETFs, funds, warrants or preferred shares.</span></li>
          <li><Check /><span><strong>Primary listings only</strong>, so dual share classes don&rsquo;t appear twice.</span></li>
          <li><Check /><span><strong>Real liquidity</strong> — an adjustable floor on average daily volume <em>in USD</em>, which is the single best filter against thin, manipulated names. A share-count floor would be meaningless across markets: 200k shares is trivial for a ¥3,000 Tokyo listing and roughly $150M a day for a ₩1.6M Seoul one.</span></li>
          <li><Check /><span><strong>Genuinely rising</strong> — positive over <em>both</em> one month and three months, not one masking the other.</span></li>
          <li><Check /><span><strong>Trend intact</strong> — price above its 50-day average and the 50-day above the 200-day, so you get uptrends rather than bounces inside downtrends.</span></li>
        </ul>
      </section>

      <div className="cta-band">
        <h2>See what&rsquo;s running right now</h2>
        <p>Live data, sortable, adjustable filters. Nothing to install or sign up for.</p>
        <Link href="/screener" className="btn btn-primary btn-lg">
          Open the screener <Arrow />
        </Link>
      </div>

      <div className="footer">
        <span>
          Data from the TradingView screener, delayed. Streak is a research
          tool, not investment advice — nothing here is a recommendation to buy
          or sell any security.
        </span>
      </div>
    </main>
  );
}
