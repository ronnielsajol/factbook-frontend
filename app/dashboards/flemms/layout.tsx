import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reading, Reasoning & Reaching — FLEMMS 2024 | Factbook",
  description: "Explore Philippine basic and functional literacy, regional and gender gaps, age patterns, internet use, and mass-media exposure in the 2024 FLEMMS.",
  openGraph: {
    title: "Reading, Reasoning & Reaching — FLEMMS 2024",
    description: "A Factbook dashboard about literacy and digital life in the Philippines.",
    images: [{ url: "/thumbnails/flemms.png", width: 1747, height: 909, alt: "FLEMMS 2024 literacy dashboard: 93.1% basic literacy, 70.8% functional literacy." }],
  },
  twitter: { card: "summary_large_image", title: "Reading, Reasoning & Reaching — FLEMMS 2024", images: ["/thumbnails/flemms.png"] },
};

export default function FlemmsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
