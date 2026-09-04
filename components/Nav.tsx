"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "./Icons";

export default function Nav() {
  const path = usePathname();
  const onScreener = path.startsWith("/screener");
  const onArchive = path.startsWith("/archive");

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <Mark />
          Streak
        </Link>
        <div className="nav-links">
          <Link
            href="/"
            className={`nav-link${!onScreener && !onArchive ? " active" : ""}`}
          >
            Overview
          </Link>
          <Link href="/screener" className={`nav-link${onScreener ? " active" : ""}`}>
            Screener
          </Link>
          <Link href="/archive" className={`nav-link${onArchive ? " active" : ""}`}>
            Archive
          </Link>
        </div>
        <div className="nav-spacer" />
        <Link
          href="/screener"
          className={`btn btn-sm${onScreener ? "" : " btn-primary"}`}
        >
          {onScreener ? "Refresh view" : "Open screener"}
        </Link>
      </div>
    </nav>
  );
}
