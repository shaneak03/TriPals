import type { Metadata } from "next";
import { SiteHeader } from "@/components/home/site-header";
import { WalkPlanner } from "@/components/walks/walk-planner";

export const metadata: Metadata = {
  title: "Walk Milan — TriPals",
  description: "Compare the fastest walk with the route that passes the most to see.",
};

// Walks, budgets and categories are read from Supabase in the browser (with a saved
// fallback in public/data/walks), so dashboard edits show up without a redeploy.
export default function WalksPage() {
  return (
    <>
      <SiteHeader active="walks" />
      <main>
        <WalkPlanner cityId="milan" />
      </main>
    </>
  );
}
