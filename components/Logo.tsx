"use client";

import { useState } from "react";

const SRC = (logoid: string) =>
  `https://s3-symbol-logo.tradingview.com/${logoid}--big.svg`;

/**
 * Company mark from TradingView's logo CDN, falling back to the ticker's first
 * two letters. Roughly 3% of names have no logoid at all, and the CDN 404s for
 * a few more, so the fallback is the common path often enough to matter.
 */
export default function Logo({
  logoid,
  name,
  size = 22,
}: {
  logoid: string | null;
  name: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };

  if (!logoid || broken) {
    return (
      <span className="logo logo-fallback" style={style} aria-hidden>
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="logo"
      style={style}
      src={SRC(logoid)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}
