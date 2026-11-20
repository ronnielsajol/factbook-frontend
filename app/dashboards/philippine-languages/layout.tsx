import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Top Languages Spoken at Home in the Philippines — Factbook",
  description: "Explore the leading languages generally spoken at home across Philippine regions and provinces using the 2020 Census.",
  openGraph: { title: "Top Languages Spoken at Home in the Philippines", description: "A regional and provincial view of leading household languages in the 2020 Census.", images: [] },
  twitter: { card: "summary", title: "Top Languages Spoken at Home in the Philippines", description: "A regional and provincial view of leading household languages in the 2020 Census.", images: [] },
};

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
