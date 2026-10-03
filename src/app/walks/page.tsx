import type { Metadata } from "next";
import { SiteHeader } from "@/components/home/site-header";
import { WalkPlanner } from "@/components/walks/walk-planner";
import type { WalkIndex } from "@/lib/walks";
import walkIndex from "../../../public/data/routes/index.json";

export const metadata: Metadata = {
  title: "Walk Milan — TriPals",
  description: "Compare the fastest walk with the route that passes the most to see.",
};

export default function WalksPage() {
  return (
    <>
      <SiteHeader active="walks" />
      <main>
        <WalkPlanner index={walkIndex as WalkIndex} />
      </main>
    </>
  );
}
