import Link from 'next/link';
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
        
        {/* Navigation to your newly built features */}
        <div className="flex justify-center gap-4 p-8 relative z-10 bg-white">
          <Link href="/connect" className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition shadow-sm">
            Find Travel Pals
          </Link>
          <Link href="/shared/12345" className="bg-gray-800 text-white px-6 py-3 rounded-md font-medium hover:bg-gray-900 transition shadow-sm">
            View Sample Itinerary
          </Link>
        </div>

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