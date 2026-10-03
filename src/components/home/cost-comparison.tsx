import { CountUp, InView } from "../in-view";

type RouteOption = {
  route: string;
  flight: number;
  transfers: number;
  badge?: string;
};

// Hand-built demo numbers: the £19 Ryanair fare loses once transfers are added.
const options: RouteOption[] = [
  { route: "LHR → LIN", flight: 45, transfers: 13, badge: "Best value" },
  { route: "STN → BGY", flight: 19, transfers: 45 },
];

const maxTotal = Math.max(...options.map((o) => o.flight + o.transfers));

export function CostComparison() {
  const [best, cheapestTicket] = options;
  const saving = cheapestTicket.flight + cheapestTicket.transfers - (best.flight + best.transfers);

  return (
    <section id="true-cost" className="mx-auto w-full max-w-[1200px] px-5 py-24 lg:px-8 lg:py-40">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-20">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <h2 className="text-[36px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
            The cheapest flight isn&apos;t the cheapest trip.
          </h2>
          <p className="text-lg leading-relaxed text-muted">
            Add the Stansted Express and the bus, and Bergamo costs more than Linate.
          </p>
        </div>

        <InView className="flex flex-col gap-3 lg:col-span-7 lg:gap-6">
          {options.map(({ route, flight, transfers, badge }) => {
            const total = flight + transfers;
            return (
              <article key={route} className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-ink">{route}</h3>
                    {badge && (
                      <span className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold tracking-[0.04em] text-ink">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[32px] font-semibold tabular-nums text-ink">£{total}</p>
                </div>

                {/* True-cost bar: length is proportional to the total, segments to flight vs transfers. */}
                <div
                  role="img"
                  aria-label={`Flight £${flight}, transfers £${transfers}`}
                  className="mb-4 h-2 w-full overflow-hidden rounded-full bg-sand"
                >
                  <div
                    className="flex h-full origin-left overflow-hidden rounded-full transition-transform duration-[400ms] ease-out group-data-[inview=false]:scale-x-0"
                    style={{ width: `${(total / maxTotal) * 100}%` }}
                  >
                    <div className="h-full bg-primary" style={{ width: `${(flight / total) * 100}%` }} />
                    <div className="h-full flex-1 bg-accent" />
                  </div>
                </div>

                <p className="text-sm text-muted tabular-nums">
                  Flight £{flight} · Transfers £{transfers}
                </p>
              </article>
            );
          })}

          <p className="rounded-control bg-accent-tint px-4 py-3 text-ink">
            You save{" "}
            <span className="font-semibold text-accent">
              <CountUp value={saving} prefix="£" />
            </span>{" "}
            and arrive 85 minutes earlier.
          </p>
        </InView>
      </div>
    </section>
  );
}
