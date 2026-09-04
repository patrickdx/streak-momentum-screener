import type { NextConfig } from "next";

/**
 * GitHub Pages serves static files only, so the whole app is prerendered.
 *
 * That is possible because TradingView answers CORS-simple requests (see
 * lib/tradingview.ts): the screener fetches and scores in the browser, with no
 * server to route through. The archive is generated at build time from the
 * JSON committed under data/snapshots/, so new snapshots appear when the
 * daily job's commit triggers a rebuild.
 *
 * A project page is served from /<repo>, so assets need that prefix. Set
 * NEXT_PUBLIC_BASE_PATH in CI; local dev leaves it empty and serves from /.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  reactStrictMode: true,
  // Pages has no image optimizer.
  images: { unoptimized: true },
  // Emits /path/index.html instead of /path.html, which is what Pages'
  // directory-style routing expects.
  trailingSlash: true,
};

export default nextConfig;
