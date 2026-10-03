import Image from "next/image";
import { ArrowRight, CalendarDays, MapPin, PlaneTakeoff, User, type LucideIcon } from "lucide-react";
import heroImage from "../../../public/images/hero-milan.jpg";

type SearchField = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  span: string;
};

// Demo search: London → Milan is the hero route for the MVP.
const fields: SearchField[] = [
  { icon: PlaneTakeoff, label: "From", value: "London", hint: "All airports", span: "col-span-2 lg:col-span-3" },
  { icon: MapPin, label: "To", value: "Milan", hint: "Centrale & airports", span: "col-span-2 lg:col-span-3" },
  { icon: CalendarDays, label: "Departure", value: "12 Nov", span: "col-span-1 lg:col-span-2" },
  { icon: User, label: "Travellers", value: "1 traveller", span: "col-span-1 lg:col-span-2" },
];

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[640px] flex-col justify-end overflow-hidden lg:min-h-[700px]">
      <Image
        src={heroImage}
        alt="Sunlit street of old townhouses with flower-filled balconies"
        fill
        sizes="100vw"
        placeholder="blur"
        loading="eager"
        fetchPriority="high"
        className="-z-20 object-cover"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent" />

      <div className="mx-auto w-full max-w-[1200px] px-5 pb-12 pt-32 lg:px-8 lg:pb-16">
        <div className="max-w-[780px]">
          <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] text-white sm:text-[48px] lg:text-[56px]">
            The cheapest flight isn&apos;t the cheapest trip.
          </h1>
          <p className="mt-4 max-w-[620px] text-lg leading-relaxed text-white/80">
            See what your trip really costs door to door, then walk the route with the most to see.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 items-center gap-2 rounded-card bg-surface p-4 shadow-card sm:gap-4 sm:p-6 lg:grid-cols-12 lg:p-8">
          {fields.map(({ icon: Icon, label, value, hint, span }) => (
            <button
              key={label}
              type="button"
              className={`${span} flex min-w-0 items-center gap-3.5 rounded-control p-3 text-left transition-colors hover:bg-sand`}
            >
              <Icon aria-hidden className="size-[22px] shrink-0 text-primary" strokeWidth={1.75} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-muted">{label}</span>
                <span className="block truncate font-semibold text-ink">{value}</span>
                {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
              </span>
            </button>
          ))}

          {/* Search isn't built yet — for the demo, jump to the London → Milan comparison. */}
          <a
            href="#true-cost"
            className="col-span-2 flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-accent px-4 font-medium text-white transition-colors hover:bg-accent-hover active:scale-[0.98] lg:col-span-2"
          >
            Find true cost
            <ArrowRight aria-hidden className="size-[18px]" strokeWidth={1.75} />
          </a>
        </div>
      </div>
    </section>
  );
}
