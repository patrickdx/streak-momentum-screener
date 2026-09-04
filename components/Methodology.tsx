import { WEIGHTS } from "@/lib/momentum";

const ROWS: { label: string; weight: number; blurb: string }[] = [
  {
    label: "Relative Strength",
    weight: WEIGHTS.relativeStrength,
    blurb: "Blended return across 1W / 1M / 3M / 6M, weighted 15/35/30/20.",
  },
  {
    label: "Risk-Adjusted",
    weight: WEIGHTS.riskAdjusted,
    blurb: "That return divided by monthly volatility — a steady grinder beats a lottery ticket with the same headline gain.",
  },
  {
    label: "Streak Consistency",
    weight: WEIGHTS.consistency,
    blurb: "How many of the four non-overlapping legs were up, tie-broken by the worst leg.",
  },
  {
    label: "Trend Structure",
    weight: WEIGHTS.trendStructure,
    blurb: "Moving-average stack (price > 20d > 50d > 200d) plus proximity to the 52-week high.",
  },
  {
    label: "Volume Thrust",
    weight: WEIGHTS.volumeThrust,
    blurb: "Relative volume and 10-day vs. 30-day volume expansion — is money actually rotating in.",
  },
];

export default function Methodology() {
  return (
    <details className="method">
      <summary>Full methodology — how the score is calculated</summary>
      <div className="method-body">
        <p style={{ marginTop: 0 }}>
          A single big number on one timeframe is a bad momentum signal — a
          takeover pop prints the same <code>+80% 1M</code> as a stock that has
          ground higher all year. This model scores five independent dimensions
          and <strong>percentile-ranks each one against the entire liquid US
          universe</strong>, then blends them. Ranking happens before filtering,
          so a score of 90 means &ldquo;top decile of all US large caps,&rdquo;
          not &ldquo;top decile of the ones already trending.&rdquo;
        </p>

        <h3>Score components</h3>
        <div className="weights">
          {ROWS.map((r) => (
            <div key={r.label} style={{ display: "contents" }}>
              <div className="weight-name" title={r.blurb}>
                {r.label}
              </div>
              <div className="weight-bar">
                <div className="weight-fill" style={{ width: `${r.weight * 100 / 0.3}%` }} />
              </div>
              <div className="weight-val">{(r.weight * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>

        <h3>The streak metric</h3>
        <p style={{ margin: 0 }}>
          TradingView reports <em>cumulative</em> returns, which overlap — a
          strong week inflates the 1M, 3M and 6M numbers all at once. The four
          pips decompose them back into independent windows, oldest on the
          left: <code>months 4-6</code>, <code>months 2-3</code>,{" "}
          <code>weeks 2-4</code>, <code>past week</code>. Four filled pips means
          the stock advanced in every one of them — a genuine streak rather than
          one good day carried forward. Hover the pips for each window&rsquo;s
          return.
        </p>

        <h3>Hard gates</h3>
        <ul>
          <li>US common stock on NASDAQ / NYSE / AMEX — no OTC, ETFs, funds, warrants or preferreds</li>
          <li>Primary listing only, so dual-share classes don&rsquo;t double-count</li>
          <li>Market cap, share price and average dollar volume above your thresholds</li>
          <li>Positive on <em>both</em> the 1-month and 3-month horizon</li>
          <li>With &ldquo;Uptrend intact&rdquo; on: price above the 50-day and the 50-day above the 200-day</li>
          <li>Within your maximum distance from the 52-week high</li>
        </ul>

        <h3>Reading the signals</h3>
        <ul>
          <li><strong>52W High</strong> — within 2% of the 52-week high</li>
          <li><strong>Accelerating</strong> — last week&rsquo;s pace is more than double the prior two months</li>
          <li><strong>Extended</strong> — RSI ≥ 80 or 25%+ above the 20-day MA; strong, but a poor entry</li>
          <li><strong>Pullback</strong> — cooling below the 20-day MA or RSI &lt; 50 while the larger trend holds</li>
          <li><strong>Vol Spike</strong> — trading at 2x+ its normal 10-day volume</li>
        </ul>
      </div>
    </details>
  );
}
