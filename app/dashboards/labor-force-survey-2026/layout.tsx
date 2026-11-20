import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Philippine Labor Force Survey: June 2026 | Factbook",
  description: "An interactive reading of the June 2026 Philippine Labor Force Survey, covering employment, unemployment, underemployment, industries, and working hours.",
  openGraph: { title: "Philippine Labor Force Survey: June 2026", description: "Employment, unemployment, underemployment, industries, and working hours in June 2026.", images: [] },
  twitter: { card: "summary", title: "Philippine Labor Force Survey: June 2026", description: "An interactive Factbook view of the June 2026 Labor Force Survey.", images: [] },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
