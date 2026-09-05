"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalIcon } from "./Icons";

/**
 * TradingView's symbol-profile widget: sector, industry, headcount and — the
 * reason it is here — a plain-English description of what the business
 * actually does.
 *
 * That description is not available any other way. The scanner exposes a
 * `business_description` column and the `/symbol` endpoint accepts the field,
 * but both return null for anonymous callers, and the widget's own data call
 * lives inside a minified bundle with no documented endpoint behind it.
 *
 * Unlike the price chart, this one renders for every market covered here —
 * Tokyo, Seoul and Shenzhen all return full English descriptions even though
 * their *price* feeds need a TradingView account.
 *
 * Mounted imperatively because the loader reads its configuration from the
 * text content of its own <script> tag, which React will not render.
 */
export default function CompanyProfile({
  symbol,
  // A compromise: the widget cannot autosize to its content across origins,
  // and descriptions range from two lines (Terra Drone) to a dozen (Mitsubishi
  // UFJ). 320 clipped the long ones; 400 left a visible gap under the short
  // ones. At 360 the longest profiles scroll internally by a line or two,
  // which is the cheaper failure.
  height = 360,
}: {
  symbol: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    node.innerHTML = "";
    setFailed(false);

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    container.appendChild(inner);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js";
    script.textContent = JSON.stringify({
      symbol,
      width: "100%",
      height,
      colorTheme: "light",
      // Transparent so it sits on the card rather than in a box of its own.
      isTransparent: true,
      locale: "en",
    });
    script.onerror = () => setFailed(true);

    container.appendChild(script);
    node.appendChild(container);

    return () => {
      node.innerHTML = "";
    };
  }, [symbol, height]);

  const url = `https://www.tradingview.com/symbols/${symbol.replace(":", "-")}/`;

  return (
    <div className="profile">
      <div className="profile-head">
        <h3>What the business does</h3>
        <a className="tv-chart-link" href={url} target="_blank" rel="noreferrer">
          Full profile <ExternalIcon />
        </a>
      </div>
      {failed ? (
        <p className="sheet-note">
          The company profile could not load. Use the link above for
          TradingView&rsquo;s full profile.
        </p>
      ) : (
        <div className="profile-body" ref={host} style={{ minHeight: height }} />
      )}
    </div>
  );
}
