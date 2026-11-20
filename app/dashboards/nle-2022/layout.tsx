import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "2022 National and Local Elections — Factbook",
  description: "Explore how every Senate candidate ranked across Philippine regions, provinces, cities, and municipalities in the 2022 election.",
  openGraph: {
    title: "2022 National and Local Elections — Factbook",
    description: "An interactive geographic view of candidate ranks and votes in the 2022 Philippine Senate election.",
  },
  twitter: {
    title: "2022 National and Local Elections — Factbook",
    description: "An interactive geographic view of candidate ranks and votes in the 2022 Philippine Senate election.",
  },
};

export default function ElectionResultsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
