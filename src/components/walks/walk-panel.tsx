import { Building2 } from "lucide-react";
import { useId } from "react";
import {
  countSights,
  formatDistance,
  formatMinutes,
  isSight,
  type Poi,
  type Route,
  type City,
  type TimeBudget,
  type WalkPair,
} from "@/lib/walks";
import type { RouteKind } from "./walk-map";

export function CitySelect({
  cities,
  value,
  onChange,
}: {
  cities: City[];
  value: string;
  onChange: (cityId: string) => void;
}) {
  return (
    <PlaceSelect
      label="City"
      icon={<Building2 aria-hidden className="size-5" strokeWidth={1.75} />}
      value={value}
      options={cities.map((c) => ({ id: c.id, name: `${c.name}, ${c.country}` }))}
      onChange={onChange}
    />
  );
}

/** Preset walks as chips; picking one fills both start and destination. */
export function SuggestedWalks({
  pairs,
  activeId,
  onPick,
}: {
  pairs: WalkPair[];
  activeId: string | null;
  onPick: (pair: WalkPair) => void;
}) {
  if (!pairs.length) return null;
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-[13px] text-muted">Suggested walks</h2>
      <div className="flex flex-wrap gap-2">
        {pairs.map((pair) => {
          const active = pair.id === activeId;
          return (
            <button
              key={pair.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(pair)}
              className={`min-h-9 rounded-full px-3.5 py-1.5 text-left text-[13px] leading-tight transition-colors ${
                active ? "bg-primary text-white" : "bg-primary-tint text-ink hover:bg-primary-tint/70"
              }`}
            >
              {pair.label}
            </button>
          );
        })}
      </div>
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
  poisById,
  selected,
  onSelect,
}: {
  fastest: Route;
  scenic: Route | null; // null when this budget hasn't been computed yet
  poisById: Map<string, Poi>;
  selected: RouteKind;
  onSelect: (kind: RouteKind) => void;
}) {
  const sameRoute = scenic?.extra_pois === 0 && scenic.distance_m === fastest.distance_m;
  const fastestSights = countSights(fastest, poisById);
  const moreSights = scenic ? countSights(scenic, poisById) - fastestSights : 0;
  const extraMin = Math.round(scenic?.extra_min ?? 0);
  return (
    <div className="mt-6 space-y-3">
      <RouteCard
        title="Fastest"
        route={fastest}
        sights={fastestSights}
        swatch={<span className="block h-1 w-6 rounded-full bg-[repeating-linear-gradient(90deg,#B8C2C9_0_6px,transparent_6px_10px)]" />}
        active={selected === "fastest"}
        onClick={() => onSelect("fastest")}
      />
      {scenic ? (
        <RouteCard
          title="Most to see"
          route={scenic}
          sights={fastestSights + moreSights}
          swatch={<span className="block h-[5px] w-6 rounded-full bg-accent" />}
          active={selected === "scenic"}
          onClick={() => onSelect("scenic")}
          chip={
            sameRoute
              ? "Same as fastest"
              : moreSights > 0
                ? `+${extraMin} min · ${moreSights} more ${moreSights === 1 ? "sight" : "sights"}`
                : `+${extraMin} min · livelier streets`
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
  sights,
  swatch,
  active,
  onClick,
  chip,
}: {
  title: string;
  route: Route;
  sights: number; // highlighted POIs only, so it matches the pins
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
          {formatDistance(route.distance_m)} · {sights} {sights === 1 ? "sight" : "sights"}
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
  startName,
  endName,
  route,
  poisById,
}: {
  startName: string;
  endName: string;
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
        <Stop minute={0} name={startName} pill="Start" />
        {stops.map(({ poi, minute }) => (
          <Stop key={poi.id} minute={minute} name={poi.name} pill={poi.category_label} />
        ))}
        <Stop minute={route.duration_min} name={endName} pill="Arrive" />
      </ol>
      {others > 0 && (
        <p className="mt-3 px-1 text-[13px] text-muted">
          Plus {others} cafés, shops and other places within 30 m of the route.
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
