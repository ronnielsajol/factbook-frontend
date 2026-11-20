import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const sans = localFont({ src: "./fonts/geist-98bbbccb.woff2", weight: "100 900", variable: "--font-sans" });
const mono = localFont({ src: "./fonts/geist-mono-013b2f2f.woff2", weight: "100 900", variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dc-factbook.com"),
  title: "Factbook — Philippine data, made explorable",
  description: "Discover independent interactive dashboards about the Philippine economy, people, infrastructure, technology, and public life.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Factbook",
    description: "Philippine data, made explorable.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Factbook — Philippine data, made explorable." }],
  },
  twitter: { card: "summary_large_image", title: "Factbook", description: "Philippine data, made explorable.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
