# Streak — Momentum Screener

US stocks ranked by a five-factor momentum score. Next.js + TypeScript, data
from the TradingView screener, built on the Geist type and colour scales in a
light theme.

A landing page explaining what the tool does, a live screener with a sortable
table and a sector heatmap, and an archive of daily snapshots captured
automatically by GitHub Actions.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3111. No API keys or `.env` needed — the TradingView
scanner endpoint is unauthenticated.

- `/` — landing page: what it does, why percentage-sorting fails, the five factors
- `/screener` — the live table and heatmap
- `/archive` — every captured day
- `/archive/<date>` — one day's screen, with rank movement vs. the previous day

Capture a snapshot by hand at any time:

```bash
npm run snapshot
```

## Deploying

It's a standard Next.js app, so anywhere that runs Node works — Vercel, Netlify,
Railway, Fly, a container, or `npm run build && npm start` on your own box. The
only requirement is a **server-side runtime**: `/api/screener` has to run on the
server, so this can't be exported as a purely static site (see below for why).

```bash
npm run build && npm start
```

Nothing to configure, no environment variables.

## How momentum is detected

A single big number on one timeframe is a bad momentum signal. A takeover pop
prints the same `+80% 1M` as a stock that has ground higher all year, and a
screener that just sorts by `Perf.1M` returns mostly the former. This model
scores five independent dimensions and **percentile-ranks each against the
entire liquid US universe (~1,900 names)**, then blends the ranks.

| Component | Weight | What it measures |
|---|---|---|
| Relative Strength | 30% | Return across 1W / 1M / 3M / 6M, horizons weighted 15/35/30/20 |
| Risk-Adjusted | 20% | That return per unit of monthly volatility |
| Streak Consistency | 15% | How many of four non-overlapping legs were up |
| Trend Structure | 20% | Moving-average stack plus proximity to the 52-week high |
| Volume Thrust | 15% | Relative volume and 10d-vs-30d volume expansion |

Two design decisions do most of the work:

**Ranking happens before filtering.** The universe is scored whole, then the
momentum gates are applied. So a score of 90 means "top decile of all liquid US
large caps," not "top decile of the names that were already trending" — which
would be circular.

**Each horizon is ranked before the horizon weights are applied.** Weighting raw
percentages would let whichever horizon carries the biggest numbers dominate: a
stock up 1% on the month but 250% over six months would swamp the 1M term
despite 1M carrying the larger weight. Rank first and a weight of 0.35 really is
35% of the influence. (This was a real bug during development — it was floating
names with flat recent action into the top 5.)

### The streak metric

TradingView reports *cumulative* returns, which overlap: one strong week
inflates the 1M, 3M and 6M figures simultaneously. `computeLegs` divides them
back into four independent windows —

```
[ past week ][ weeks 2-4 ][ months 2-3 ][ months 4-6 ]
```

— by dividing successive growth multiples. Four filled pips means the stock
advanced in every one of them: a genuine streak, not one good day carried
forward. Hover the pips for each leg's return.

### Hard gates

- US common stock on NASDAQ / NYSE / AMEX — no OTC, ETFs, funds, warrants, preferreds
- Primary listing only, so dual share classes don't double-count
- Market cap, share price, and average dollar volume above the chosen thresholds
- Positive on **both** the 1-month and 3-month horizon
- With "Uptrend intact": price above the 50-day, and the 50-day above the 200-day
- Within the chosen distance from the 52-week high

The liquidity gate uses `avg 30d volume x price` rather than TradingView's
`Value.Traded`, which is a single-session figure — one quiet day would otherwise
evict a perfectly liquid name.

### Signals

| Chip | Meaning |
|---|---|
| **52W High** | Within 2% of the 52-week high |
| **Accelerating** | Last week's pace is more than double the prior two months |
| **Extended** | RSI ≥ 80 or 25%+ above the 20-day MA — strong, but a poor entry |
| **Pullback** | Cooling below the 20-day MA or RSI < 50 while the larger trend holds |
| **Vol Spike** | Trading at 2x+ its normal 10-day volume |

## Layout

```
app/
  page.tsx                landing page
  screener/page.tsx       filters, presets, table/heatmap toggle
  archive/page.tsx        list of captured days
  archive/[date]/page.tsx one day, with rank movement
  api/screener/route.ts   server proxy: validates params, fetches, scores
  globals.css             the whole design system
lib/
  tradingview.ts          scanner client, column mapping, pagination
  momentum.ts             the scoring engine
  treemap.ts              squarified treemap layout
  snapshots.ts            archive read/write, canonical filters
  types.ts  format.ts
components/
  Nav.tsx                 shared header
  ScreenerTable.tsx       sortable table, optional rank-movement column
  Heatmap.tsx             sector treemap
  SnapshotView.tsx        archive table/heatmap toggle
  Methodology.tsx         in-app explanation of the score
  Logo.tsx  Icons.tsx
scripts/
  snapshot.ts             the daily capture job
data/snapshots/           committed archive, one JSON per trading day
.github/workflows/        the daily cron
```

## Design

Geist Sans and Geist Mono, on the Geist colour scales in light mode. Text
colours are taken from the darker end of each hue so that 13px financial
figures clear WCAG AA against white — gains in `--green` `#0f7b32`, losses in
`--red` `#c62a2f`, interactive elements in `--blue` `#0072f5`.

Company logos come from TradingView's logo CDN
(`s3-symbol-logo.tradingview.com/<logoid>--big.svg`). About 3% of names have no
`logoid` and the CDN 404s for a few more, so [Logo.tsx](components/Logo.tsx)
falls back to the ticker's first two letters — that path runs often enough to
matter.

One CSS gotcha worth knowing if you touch the table: `.table-wrap` has
`overflow-x: auto`, which makes it the containing block for `position: sticky`.
A `top` offset on `thead th` therefore pushes the header *down inside the
table* and hides the first row, rather than offsetting it from the viewport.
It has to stay `top: 0`.

## Why the API route exists

TradingView's scanner sets `Access-Control-Allow-Headers: Referer,Accept`. A
browser `POST` with `Content-Type: application/json` fails preflight, so the
request has to be made server-side. The route also does the scoring, which keeps
~1,900 rows of raw quotes off the wire — the client receives only the ranked
slice it renders.

The scanner returns at most 1,000 rows per request, so `fetchUniverse`
paginates.

## The daily archive

`.github/workflows/daily-snapshot.yml` runs at 22:00 UTC on weekdays — 6pm ET
during EDT, 5pm ET during EST, always after the 4pm close — and commits the
result to `data/snapshots/<date>.json`. No database, no external storage: the
repo *is* the archive, and the files are readable without the app.

Every snapshot uses `CANONICAL_FILTERS` from [lib/snapshots.ts](lib/snapshots.ts)
rather than whatever the UI happens to be set to. That is the point of the
archive — if the filters drifted day to day, comparing two days would be
comparing two different questions.

Two guards keep the archive honest:

- **Sanity check.** A healthy run sees ~1,900 names. If the fetch returns fewer
  than 200, the script throws instead of committing a snapshot that looks
  broken because the upstream API changed shape or rate-limited us.
- **Market-holiday guard.** The cron fires every weekday, but on a closed day
  TradingView returns the previous session verbatim. The script fingerprints
  the top 100 closing prices and skips the write when they are identical to the
  last stored day, rather than recording a trading day that never happened.

Snapshots are written compact, with floats rounded — TradingView returns full
doubles like `39.02439024390244`, which was ~45% of each file's bytes and none
of its information. That took a day from 149 KB to 81 KB, or roughly 20 MB a
year.

To backfill or overwrite: `npm run snapshot -- --force --date=2026-09-04`. Note
this fetches *current* data and files it under the date you name — it can't
recover a day that was missed.

## The heatmap

A squarified treemap ([lib/treemap.ts](lib/treemap.ts), Bruls–Huizing–van Wijk),
grouped by sector, tiles sized by market cap and coloured by momentum score.

Market cap is **square-root scaled** so a $300B name doesn't swallow the canvas
and leave the $1B names as unreadable slivers. The colour buckets are fixed cut
points rather than scaled to whatever is on screen — the archive exists to
compare days, and a relative scale would make every day look identical.

The inner tiles come back in coordinates local to their sector cell, because
they render inside an absolutely-positioned sector element where percentages
resolve against the sector rather than the canvas.

## Notes

Quotes are delayed. Responses carry `s-maxage=60, stale-while-revalidate=300`,
so a CDN that honours it will serve a cached copy for a minute and keep the app
clear of rate limits. This is a research tool, not investment advice.

Running `npm run build` while `npm run dev` is live will kill the dev server —
they share the `.next` directory.
