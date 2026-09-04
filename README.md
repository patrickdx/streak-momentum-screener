# Streak — Momentum Screener

Stocks across four markets — **United States, Japan, South Korea and China** —
ranked by a five-factor momentum score. Next.js + TypeScript, data from the
TradingView screener, built on the Geist type and colour scales in a light
theme.

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
- `/screener` — the live table and heatmap, per market or all four merged
- `/archive?market=<market>` — every captured day for that market
- `/archive/<market>/<date>` — one day's screen, with rank movement vs. the previous day

Capture a snapshot by hand at any time:

```bash
npm run snapshot
```

```bash
npm run snapshot -- --markets=japan,korea --force
```

## Deploying

The whole app is **static**. `npm run build` writes `out/`, which can be served
by GitHub Pages, Netlify, S3, or any file server — no Node runtime, no
database, no environment variables.

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every
push to `main`. Because the daily snapshot job commits to `main`, a new trading
day appears on the live site without anyone doing anything.

A project page is served from `/<repo>`, so assets need that prefix. CI passes
it via `NEXT_PUBLIC_BASE_PATH` (from `actions/configure-pages`); local dev
leaves it empty and serves from `/`. `public/.nojekyll` is required — Jekyll
would otherwise discard `_next/`, since it ignores directories starting with an
underscore.

To preview the real thing locally:

```bash
NEXT_PUBLIC_BASE_PATH=/streak-momentum-screener npm run build
```

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
  archive/page.tsx        captured days, with market tabs
  archive/[market]/[date]/page.tsx  one day, with rank movement
  api/screener/route.ts   server proxy: validates params, fetches, scores
  globals.css             the whole design system
lib/
  tradingview.ts          scanner client, column mapping, pagination
  momentum.ts             the scoring engine
  treemap.ts              squarified treemap layout
  markets.ts              market registry (add a country here)
  fx.ts                   USD conversion rates
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
data/snapshots/<market>/  committed archive, one JSON per market per day
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

## How it runs without a server

TradingView's scanner replies with `Access-Control-Allow-Headers: Referer,Accept`,
so a browser `POST` carrying `Content-Type: application/json` trips a preflight
and is blocked. That is why earlier versions proxied through an API route.

But `text/plain` is a **CORS-safelisted** `Content-Type`, which makes the same
request a *simple request* — no preflight — and the server parses the body as
JSON anyway. Verified in a real browser:

| Request | Result |
|---|---|
| `Content-Type: application/json` | blocked — failed preflight |
| `Content-Type: text/plain;charset=UTF-8` | 200 OK |
| no `Content-Type` header | 200 OK |

So the screener fetches and scores entirely in the browser, the API route is
gone, and the app ships as static files. The same code runs server-side in the
snapshot script, so there is one definition of the score
([lib/screen.ts](lib/screen.ts)).

The scanner returns at most 1,000 rows per request, so `fetchUniverse`
paginates.

The archive is generated at build time from the committed JSON via
`generateStaticParams` — one page per market, one per snapshot.

## Markets and currency

Adding a country is mostly a row in [lib/markets.ts](lib/markets.ts) — every
TradingView market endpoint accepts the same column set.

The catch is currency. Each market reports price and market cap in its own
currency, and **the API has no conversion option**: a top-level `currency`
key, `options.currency`, and a `market_cap_basic|USD` column suffix were all
tested and silently ignored. So [lib/fx.ts](lib/fx.ts) pulls spot rates from
TradingView's own forex endpoint and the scanner client converts. A missing
rate throws rather than defaulting to 1 — a rate of 1 for KRW would report
every Korean company at ~1,300x its true size and quietly corrupt the archive.

What that buys: **prices stay in local currency** (yen, won, yuan) because that
is what the market quotes, while **market cap and the liquidity floor are USD**,
so "$1B and up" means the same thing in Seoul as in New York. Filter thresholds
are converted on the way *into* the query rather than fetched and trimmed after.

Two decisions worth knowing:

**Each market is ranked against itself, never pooled.** A percentile is a
statement about a stock's peers, and Tokyo and New York can be in entirely
different regimes; pooling would let a flat month in a strong market outrank a
good month in a weak one purely because of what it was measured against. The
"All markets" view scores each market independently, then merges — which is
sound precisely because every score is already a within-market percentile.

**There is no average-share-volume filter.** A fixed share count means
completely different things across markets: 200k shares is trivial for a ¥3,000
Tokyo listing and roughly $150M/day for a ₩1.6M Seoul one. It was cutting
Korea's universe by 40% and Japan's by 20% for no real reason. Liquidity is
gated purely on USD turnover, which is price- and currency-neutral.

## The daily archive

`.github/workflows/daily-snapshot.yml` runs on **two** weekday schedules,
because the markets don't close together:

| Cron | Local time | Captures |
|---|---|---|
| `0 8 * * 1-5` | 17:00 Tokyo / 17:00 Seoul / 16:00 Shanghai | Japan, Korea, China |
| `0 22 * * 1-5` | 18:00 New York (EDT), 17:00 (EST) | United States |

Results are committed to `data/snapshots/<market>/<date>.json`. No database, no
external storage: the repo *is* the archive, and the files are readable without
the app.

**Dates are per-market, and rolled back where needed.** At 22:00 UTC it is
already tomorrow morning in Tokyo, so naively taking the local calendar date
would file Monday's close under Tuesday — which is exactly what the first
version did. `tradingDate()` in [lib/snapshots.ts](lib/snapshots.ts) takes the
market's local date, rolls back a day if the capture happened before that
market's open, and rolls back across weekends. A mistimed run is therefore
labelled correctly anyway.

Every snapshot uses `CANONICAL_FILTERS` from [lib/snapshots.ts](lib/snapshots.ts)
rather than whatever the UI happens to be set to. That is the point of the
archive — if the filters drifted day to day, comparing two days would be
comparing two different questions.

Two guards keep the archive honest:

- **Sanity check.** Every market returns hundreds of names. If a fetch returns
  fewer than 60, that market is failed instead of committing a snapshot that
  looks broken because the upstream API changed shape, rate-limited us, or an
  FX rate came back wrong. One market failing doesn't lose the others; all four
  failing fails the workflow.
- **Market-holiday guard.** The cron fires every weekday, but on a closed day
  TradingView returns the previous session verbatim. The script fingerprints
  the top 100 closing prices and skips the write when they are identical to the
  last stored day, rather than recording a trading day that never happened.

Snapshots are written compact, with floats rounded — TradingView returns full
doubles like `39.02439024390244`, which was ~45% of each file's bytes and none
of its information. That took a day from 149 KB to 81 KB, or roughly 20 MB a
year.

Markets are captured sequentially rather than in parallel — this is a
background job with no deadline, and four concurrent paginated sweeps is a good
way to get rate-limited into a failed run.

To backfill or overwrite: `npm run snapshot -- --force --date=2026-09-04`. Note
this fetches *current* data and files it under the date you name — it can't
recover a day that was missed.

## The detail card

Clicking any row — or any heatmap tile — opens a sheet for that stock:

- the momentum score with all five components broken out
- the four streak windows with their individual returns
- a **breakout ladder**: whether the price is at the top of its 1-month,
  3-month, 6-month and 52-week range
- position in the 52-week range and against the 20/50/200-day averages
- the TradingView chart, plus fundamentals and technicals
- every day this name has appeared in the stored archive, and which of those
  days it was flagged at a 52-week high

Two things worth knowing about how it gets its data:

**Extra columns are fetched per symbol, on demand.** Adding ~25 fields to the
main sweep would inflate every request and every archived snapshot for data
that is only ever read one row at a time.

**The breakout ladder takes both sides of every comparison from the same
fetch.** On an archive page the row's close is historical while the period
highs are live; mixing them reports a stock as far below a high it was sitting
on that day. `fetchDetail` therefore returns the live close alongside the live
highs, and the card says so.

### About the chart

TradingView's advanced-chart widget is embedded via their script loader — it
reads its configuration from the text content of its own `<script>` tag, so it
has to be mounted imperatively rather than rendered by React.

It draws its frame before its data arrives, and sometimes the data never
arrives: **Tokyo and Seoul both require a TradingView account**, and the
widget's streaming connection is blocked in some browsers. The "Open on
TradingView" link is therefore rendered unconditionally rather than as a
fallback — it is the reliable path, and the embed is the bonus.

## Filters

Filters come in two kinds, and the split matters:

**Universe filters** — market, market cap, price, dollar volume, distance from
the 52-week high, uptrend — change what gets fetched and scored, so they
trigger a refetch.

**Refinements** — sector, minimum score, streak windows up, RSI ceiling,
relative volume, hide-extended, at-52w-highs-only, and sort order — are applied
*after* scoring. They deliberately do not change the percentile baseline:
narrowing to one sector should surface that sector's best names with the scores
they earned against the whole market, not re-rank them among themselves.

Because refinements are a pure function of the scored list, `runScreen` returns
every candidate rather than a top-N and the UI filters in memory — moving a
slider is instant instead of re-sweeping four markets. They also run before the
top-N slice, so "top 50 healthcare names" really is the best 50 in healthcare.

Everything is saved to `localStorage` under a versioned key
([lib/prefs.ts](lib/prefs.ts)). Reads are sanitised field by field rather than
trusted: storage throws outright in some privacy modes, and a stored value may
predate a schema change or have been edited by hand.

## The archive index

`scripts/build-history.ts` runs on `prebuild` and inverts the snapshots into
`public/history/<market>.json` — ticker to appearances. The detail card wants
"which days has this name been in the screen, and where did it rank", which
lives across every snapshot file; answering it in the browser would otherwise
mean downloading the whole archive. It is generated, not committed, and capped
at 90 days so it stays small enough to fetch lazily.

## The heatmap

A squarified treemap ([lib/treemap.ts](lib/treemap.ts), Bruls–Huizing–van Wijk),
tiles sized by market cap and coloured by momentum score. Grouped by sector for
a single market, and by market when all four are merged.

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
