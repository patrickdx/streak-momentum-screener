import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    default: "Streak — Momentum Screener for US Stocks",
    template: "%s · Streak",
  },
  description:
    "Find US stocks on genuine price streaks. Every liquid large cap scored on relative strength, risk-adjusted return, streak consistency, trend structure and volume — not just a one-week pop.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>
        <Nav />
        {children}
      </body>
    </html>
  );
}
