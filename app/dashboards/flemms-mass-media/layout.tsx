import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Media and Information Access in the Philippines | Factbook",
  description: "Insights from the mass-media component of the PSA 2024 Functional Literacy, Education and Mass Media Survey.",
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
