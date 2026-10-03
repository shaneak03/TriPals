import Image, { type StaticImageData } from "next/image";
import milan from "../../../public/images/itinerary-milan.jpg";
import paris from "../../../public/images/itinerary-paris.jpg";
import barcelona from "../../../public/images/itinerary-barcelona.jpg";
import lisbon from "../../../public/images/itinerary-lisbon.jpg";

type Itinerary = {
  title: string;
  author: string;
  days: number;
  sights: number;
  image: StaticImageData;
  alt: string;
};

// Seeded, read-only itineraries for the MVP.
const itineraries: Itinerary[] = [
  {
    title: "3 Days of Hidden Brera & Navigli Canals",
    author: "Elena Rossi",
    days: 3,
    sights: 18,
    image: milan,
    alt: "Navigli canal in Milan at dusk",
  },
  {
    title: "Montmartre Backstreets & Bohemian Bistros",
    author: "Julien Mercier",
    days: 2,
    sights: 14,
    image: paris,
    alt: "Café-lined street in Montmartre, Paris",
  },
  {
    title: "Gothic Quarter Shadows & Tapas Crawl",
    author: "Marc Serra",
    days: 4,
    sights: 22,
    image: barcelona,
    alt: "Stone archway in Barcelona's Gothic Quarter",
  },
  {
    title: "Miradouros & Yellow Tram 28 Wanders",
    author: "Sofia Costa",
    days: 3,
    sights: 16,
    image: lisbon,
    alt: "Yellow tram above Lisbon rooftops",
  },
];

export function Itineraries() {
  return (
    <section id="itineraries" className="mx-auto w-full max-w-[1200px] px-5 py-24 lg:px-8 lg:py-40">
      <div className="mb-12">
        <h2 className="text-[36px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
          Shared by travellers, ready to walk
        </h2>
        <p className="mt-2 text-lg leading-relaxed text-muted">
          Complete door-to-door trips with stops and stays vetted by our community.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {itineraries.map((it) => (
          <li key={it.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={it.image}
                  alt={it.alt}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between p-5 lg:p-6">
                <div>
                  <h3 className="text-lg leading-snug font-semibold text-ink">{it.title}</h3>
                  <p className="mt-2 text-sm text-muted">{it.author}</p>
                </div>
                <p className="mt-6 border-t border-line pt-4 text-sm text-muted tabular-nums">
                  {it.days} days · {it.sights} sights
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
