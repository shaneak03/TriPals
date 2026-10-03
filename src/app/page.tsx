import { CostComparison } from "@/components/home/cost-comparison";
import { CtaBand } from "@/components/home/cta-band";
import { Features } from "@/components/home/features";
import { Hero } from "@/components/home/hero";
import { Itineraries } from "@/components/home/itineraries";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { WalkPreview } from "@/components/home/walk-preview";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="w-full pt-16 md:pt-20">
        <Hero />
        <Features />
        <CostComparison />
        <WalkPreview />
        <Itineraries />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
