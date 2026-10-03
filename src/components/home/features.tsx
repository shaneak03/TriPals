import { Calculator, Footprints, Users } from "lucide-react";

const features = [
  {
    icon: Calculator,
    title: "True door-to-door cost",
    body: "Flight and airport transfers in one price.",
  },
  {
    icon: Footprints,
    title: "Walks worth taking",
    body: "The route with the most to see, not just the fastest.",
  },
  {
    icon: Users,
    title: "Trips from real travellers",
    body: "Itineraries and stays that actually worked.",
  },
];

export function Features() {
  return (
    <section aria-label="How it works" className="mx-auto w-full max-w-[1200px] px-5 py-24 lg:px-8 lg:py-40">
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-8">
        {features.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-card border border-line bg-surface p-8 shadow-card">
            <Icon aria-hidden className="mb-6 size-7 text-primary" strokeWidth={1.75} />
            <h3 className="mb-3 text-xl font-medium text-ink">{title}</h3>
            <p className="leading-relaxed text-muted lg:text-lg">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
