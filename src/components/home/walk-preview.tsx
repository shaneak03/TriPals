import { InView } from "../in-view";

// Map drawn in a 560×360 coordinate space; labels are positioned as percentages of it.
const W = 560;
const H = 360;

const stops = [
  { name: "Brera Gallery", x: 80, y: 80, side: "right" },
  { name: "Galleria Arcade", x: 280, y: 180, side: "right" },
  { name: "Duomo di Milano", x: 460, y: 280, side: "left" },
] as const;

export function WalkPreview() {
  return (
    <section id="walks" className="mx-auto w-full max-w-[1200px] px-5 py-24 lg:px-8 lg:py-40">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-20">
        <InView className="order-2 rounded-card border border-line bg-surface p-3 shadow-card sm:p-8 lg:order-1 lg:col-span-7">
          <div
            role="img"
            aria-label="Map comparing the fastest walk with a scenic route past Brera Gallery, Galleria Arcade and the Duomo"
            className="relative aspect-[14/9] w-full overflow-hidden rounded-control bg-sand"
          >
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden>
              <g fill="none" stroke="#E6E1D8" strokeWidth="8">
                <path d="M 0 120 Q 200 130 560 90" />
                <path d="M 180 0 L 190 360" />
                <path d="M 380 0 L 360 360" />
                <path d="M 0 260 Q 300 240 560 280" />
              </g>
              {/* Fastest route */}
              <path
                d="M 80 80 L 260 170 L 460 280"
                fill="none"
                className="stroke-route-fast"
                strokeWidth="3"
                strokeDasharray="6 6"
              />
              {/* Scenic route */}
              <path
                d="M 80 80 Q 140 40 220 80 T 280 180 T 360 230 T 460 280"
                pathLength={1}
                fill="none"
                className="route-draw stroke-accent"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {stops.map((s) => (
                <circle key={s.name} cx={s.x} cy={s.y} r="8" className="fill-primary stroke-white" strokeWidth="4" />
              ))}
            </svg>

            {stops.map((s) => (
              <span
                key={s.name}
                className={`absolute -translate-y-1/2 whitespace-nowrap rounded-md bg-white/95 px-2 py-0.5 text-xs font-medium text-ink shadow-sm sm:px-2.5 sm:py-1 sm:text-sm ${
                  s.side === "left" ? "-translate-x-full -ml-4" : "ml-4"
                }`}
                style={{ left: `${(s.x / W) * 100}%`, top: `${(s.y / H) * 100}%` }}
              >
                {s.name}
              </span>
            ))}

            <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-medium text-ink tabular-nums shadow-card sm:right-5 sm:top-5 sm:px-3.5 sm:py-1.5 sm:text-sm">
              +8 min · 14 more sights
            </span>
          </div>
        </InView>

        <div className="order-1 flex flex-col gap-5 lg:order-2 lg:col-span-5">
          <h2 className="text-[36px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink sm:text-[44px]">
            Google gives you the fastest. We give you more to see.
          </h2>
          <p className="text-lg leading-relaxed text-muted">
            We score every street for sights, cafés and views, so every walk is worth taking.
          </p>
          <a href="#" className="inline-flex min-h-11 w-fit items-center font-medium text-primary hover:underline">
            Try a walk →
          </a>
        </div>
      </div>
    </section>
  );
}
