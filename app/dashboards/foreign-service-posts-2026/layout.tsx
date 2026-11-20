import type { Metadata } from "next";
import "./foreign-service-posts.css";

export const metadata: Metadata = {
  title: "Philippine Foreign Service Posts — Factbook",
  description: "Explore the Philippines’ worldwide network of embassies, consulates general, and permanent missions as of July 20, 2026.",
};

export default function ForeignServicePostsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
