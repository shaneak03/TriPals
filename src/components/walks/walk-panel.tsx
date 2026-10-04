import { Flag, MapPin } from "lucide-react";
import { useId } from "react";
import {
  formatDistance,
  formatMinutes,
  isSight,
  type Poi,
  type Route,
  type TimeBudget,
  type WalkFile,
  type WalkPair,
} from "@/lib/walks";
import type { RouteKind } from "./walk-map";

const uniqueBy = <T,>(items: T[], key: (item: T) => string) =>
  [...new Map(items.map((item) => [key(item), item])).values()];

export function PlacePickers({
  pairs,
  pairId,
  onChange,
}: {
  pairs: WalkPair[];
  pairId: string;
  onChange: (pairId: string) => void;
}) {
  const current = pairs.find((p) => p.id === pairId)!;
  // Places with is_selectable = false stay out of the dropdowns (the current one always shows).
  const starts = uniqueBy(pairs.map((p) => p.start).filter((p) => p.selectable || p.id === current.start.id), (p) => p.id);
  const ends = uniqueBy(pairs.map((p) => p.end).filter((p) => p.selectable || p.id === current.end.id), (p) => p.id);

  // Only preset walks exist, so each picker jumps to the walk that matches it.
  const pickStart = (id: string) =>
    onChange((pairs.find((p) => p.start.id === id && p.end.id === current.end.id) ?? pairs.find((p) => p.start.id === id))!.id);
  const pickEnd = (id: string) =>
    onChange((pairs.find((p) => p.end.id === id && p.start.id === current.start.id) ?? pairs.find((p) => p.end.id === id))!.id);

  return (
    <div className="mt-6 space-y-2">
      <PlaceSelect label="Start" icon={<MapPin aria-hidden className="size-5" strokeWidth={1.75} />}
        value={current.start.id} options={starts} onChange={pickStart} />
      <PlaceSelect label="Destination" icon={<Flag aria-hidden className="size-5" strokeWidth={1.75} />}
        value={current.end.id} options={ends} onChange={pickEnd} />
    </div>
  );
}

function PlaceSelect({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { id: string; name: string }[];
  onChange: (id: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] text-muted">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-primary">{icon}</span>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full cursor-pointer appearance-none rounded-control border border-line bg-surface pr-10 pl-11 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted">
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export function RouteCards({
  fastest,
  scenic,
  selected,
  onSelect,
}: {
  fastest: Route;
  scenic: Route | null; // null when this budget hasn't been computed yet
  selected: RouteKind;
  onSelect: (kind: RouteKind) => void;
}) {
  const sameRoute = scenic?.extra_pois === 0 && scenic.distance_m === fastest.distance_m;
  return (
    <div className="mt-6 space-y-3">
      <RouteCard
        title="Fastest"
        route={fastest}
        swatch={<span className="block h-1 w-6 rounded-full bg-[repeating-linear-gradient(90deg,#B8C2C9_0_6px,transparent_6px_10px)]" />}
        active={selected === "fastest"}
        onClick={() => onSelect("fastest")}
      />
      {scenic ? (
        <RouteCard
          title="Most to see"
          route={scenic}
          swatch={<span className="block h-[5px] w-6 rounded-full bg-accent" />}
          active={selected === "scenic"}
          onClick={() => onSelect("scenic")}
          chip={
            sameRoute
              ? "Same as fastest"
              : `+${Math.round(scenic.extra_min ?? 0)} min · ${scenic.extra_pois ?? 0} more places`
          }
        />
      ) : (
        <p className="rounded-card border border-dashed border-line p-4 text-[13px] text-muted">
          No &ldquo;most to see&rdquo; route for this time yet. Pick another time, or check back soon.
        </p>
      )}
    </div>
  );
}

function RouteCard({
  title,
  route,
  swatch,
  active,
  onClick,
  chip,
}: {
  title: string;
  route: Route;
  swatch: React.ReactNode;
  active: boolean;
  onClick: () => void;
  chip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-start justify-between gap-4 rounded-card border bg-surface p-4 text-left shadow-card transition-[border-color,box-shadow] hover:shadow-card-hover ${
        active ? "border-primary ring-1 ring-primary" : "border-line"
      }`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
          {swatch}
          {title}
        </span>
        <span className="mt-1 block text-[13px] text-muted tabular-nums">
          {formatDistance(route.distance_m)} · {route.poi_ids.length} places
        </span>
        {chip && (
          <span className="mt-2.5 inline-block rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent-ink tabular-nums">
            {chip}
          </span>
        )}
      </span>
      <span className="shrink-0 text-xl font-semibold text-ink tabular-nums">{formatMinutes(route.duration_min)}</span>
    </button>
  );
}

export function BudgetSlider({
  budgets,
  value,
  onChange,
}: {
  budgets: TimeBudget[];
  value: number;
  onChange: (budget: number) => void;
}) {
  const id = useId();
  const index = Math.max(0, budgets.findIndex((b) => b.minutes === value));
  const current = budgets[index];
  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          Extra time I&apos;m happy to add
        </label>
        <output htmlFor={id} className="text-[15px] font-semibold text-primary tabular-nums">
          {current?.label ?? `+${value} min`}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={budgets.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(budgets[Number(e.target.value)].minutes)}
        aria-valuetext={current?.label ?? `${value} extra minutes`}
        className="mt-4 h-11 w-full cursor-pointer accent-primary"
      />
      <div aria-hidden className="-mt-1 flex justify-between text-xs text-muted tabular-nums">
        {budgets.map((b) => (
          <span key={b.minutes} className="w-6 text-center first:text-left last:text-right">
            {b.minutes}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AlongTheWay({
  walk,
  route,
  poisById,
}: {
  walk: WalkFile;
  route: Route;
  poisById: Map<string, Poi>;
}) {
  const stops = route.poi_ids
    .flatMap((id, i) => {
      const poi = poisById.get(id);
      return poi && isSight(poi) ? [{ poi, minute: route.poi_minutes[i] }] : [];
    });
  const others = route.poi_ids.length - stops.length;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium text-ink">Along the way</h2>
      <ol className="mt-3 rounded-card border border-line bg-surface px-4 shadow-card">
        <Stop minute={0} name={walk.start.name} pill="Start" />
        {stops.map(({ poi, minute }) => (
          <Stop key={poi.id} minute={minute} name={poi.name} pill={poi.category_label} />
        ))}
        <Stop minute={route.duration_min} name={walk.end.name} pill="Arrive" />
      </ol>
      {others > 0 && (
        <p className="mt-3 px-1 text-[13px] text-muted">
          Plus {others} cafés, restaurants and shops within 30 m of the route.
        </p>
      )}
    </section>
  );
}

function Stop({ minute, name, pill }: { minute: number; name: string; pill: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <span className="w-12 shrink-0 text-[13px] text-muted tabular-nums">{formatMinutes(minute)}</span>
      <span className="min-w-0 flex-1 text-[15px] leading-5 text-ink">{name}</span>
      <span className="shrink-0 rounded-full bg-primary-tint px-2.5 py-0.5 text-xs text-ink">{pill}</span>
    </li>
  );
}
