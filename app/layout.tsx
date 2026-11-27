import MetaPixel from "./meta-pixel";
import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CRAZYWORK | Gym Clothing Malaysia — Wear What You Train For",
    template: "%s | CRAZYWORK Malaysia",
  },
  description:
    "CRAZYWORK is Malaysian gym & lifestyle apparel, released in limited drops: tank tops, muscle tees, boxy tees, oversized tees, baggy pants, shorts and socks.",
  openGraph: {
    siteName: "CRAZYWORK",
    locale: "en_MY",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable}`}
    >
<body className="antialiased">
  <MetaPixel />
  {children}
</body>
    </html>
  );
}
