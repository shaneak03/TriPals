import type { Metadata } from "next";
import { SiteHeader } from "@/components/home/site-header";
import { WalkPlanner } from "@/components/walks/walk-planner";

export const metadata: Metadata = {
  title: "City walks — TriPals",
  description: "Compare the fastest walk with the route that passes the most to see.",
};

// Cities, suggested walks, budgets and categories come from Supabase in the browser (with
// a saved fallback in public/data/walks); free start/destination routes come from the
// routing API (services/routing-api), so dashboard edits show up without a redeploy.
export default function WalksPage() {
  return (
    <>
      <SiteHeader active="walks" />
      <main>
        <WalkPlanner defaultCityId="milan" />
      </main>
    </>
  );
}
