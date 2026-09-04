"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalIcon } from "./Icons";

/**
 * TradingView's advanced-chart widget.
 *
 * It has to be mounted imperatively: the loader reads its configuration from
 * the *text content* of its own <script> tag, which React will not render.
 *
 * The widget draws its own chrome before its data arrives, and sometimes the
 * data never arrives: Tokyo and Seoul need a TradingView account, and the
 * widget's streaming connection is blocked in some browsers. So the link out
 * is rendered unconditionally rather than as a fallback — it is the reliable
 * path, and the embed is the bonus.
 */
export default function TradingViewChart({
  symbol,
  height = 300,
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
    container.style.height = `${height}px`;

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    inner.style.height = `${height}px`;
    container.appendChild(inner);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.textContent = JSON.stringify({
      symbol,
      autosize: false,
      width: "100%",
      height,
      locale: "en",
      interval: "D",
      timezone: "Etc/UTC",
      theme: "light",
      // "1" is candlesticks. TradingView's style codes: 0 bars, 1 candles,
      // 2 line, 3 area, 8 Heikin Ashi, 9 hollow candles.
      style: "1",
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      backgroundColor: "#ffffff",
    });
    script.onerror = () => setFailed(true);

    container.appendChild(script);
    node.appendChild(container);

    return () => {
      node.innerHTML = "";
    };
  }, [symbol, height]);

  const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;

  return (
    <div className="tv-chart">
      <div className="tv-chart-head">
        <span className="tv-chart-title">Price chart</span>
        <a className="tv-chart-link" href={url} target="_blank" rel="noreferrer">
          Open on TradingView <ExternalIcon />
        </a>
      </div>
      {failed ? (
        <div className="tv-chart-fallback" style={{ height }}>
          The chart widget could not load. Use the link above for the full
          interactive chart.
        </div>
      ) : (
        <div className="tv-chart-body" ref={host} style={{ minHeight: height }} />
      )}
      <p className="tv-chart-note">
        The embedded chart draws its frame before its data arrives, and stays
        empty when the feed is unavailable — Tokyo and Seoul both need a
        TradingView account, and some browsers block the widget&rsquo;s data
        connection. The link above always works.
      </p>
    </div>
  );
}
