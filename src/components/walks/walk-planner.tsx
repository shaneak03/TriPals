"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  isSight,
  loadWalk,
  loadWalkOptions,
  type Loaded,
  type WalkFile,
  type WalkOptions,
} from "@/lib/walks";
import { AlongTheWay, BudgetSlider, PlacePickers, RouteCards } from "./walk-panel";
import type { RouteKind } from "./walk-map";

// MapLibre needs the DOM and WebGL, so the map only renders in the browser.
const WalkMap = dynamic(() => import("./walk-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-[#F3EEE6]" />;
}

export function WalkPlanner({ cityId }: { cityId: string }) {
  const [options, setOptions] = useState<Loaded<WalkOptions> | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [selected, setSelected] = useState<RouteKind>("scenic");
  const [walk, setWalk] = useState<Loaded<WalkFile> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Pairs, budgets and categories: from Supabase, or the saved copy if it's unreachable.
  useEffect(() => {
    let live = true;
    loadWalkOptions(cityId).then(
      (loaded) => {
        if (!live) return;
        const { pairs, budgets } = loaded.data;
        setOptions(loaded);
        setPairId((id) => id ?? pairs[0]?.id ?? null);
        setBudget((b) => b ?? (budgets.find((t) => t.is_default) ?? budgets[0])?.minutes ?? 0);
      },
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [cityId]);

  useEffect(() => {
    if (!pairId) return;
    let live = true;
    loadWalk(cityId, pairId).then(
      (loaded) => live && (setWalk(loaded), setError(null)),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [cityId, pairId]);

  const data = walk?.data ?? null;
  const fastest = data?.fastest ?? null;
  // A budget added in the dashboard has no scenic route until the pipeline reruns.
  const scenic = (budget !== null && data?.scenic[String(budget)]) || null;
  const poisById = useMemo(() => new Map(data?.pois.map((p) => [p.id, p])), [data]);
  const shownRoute = selected === "scenic" && scenic ? scenic : fastest;
  const pins = useMemo(
    () => (shownRoute?.poi_ids ?? []).flatMap((id) => poisById.get(id) ?? []).filter(isSight),
    [shownRoute, poisById],
  );

  const pair = options?.data.pairs.find((p) => p.id === pairId) ?? null;
  const loadingWalk = !!pairId && walk?.data.id !== pairId;
  const usingSaved = options?.source === "saved" || walk?.source === "saved";
  const city = options?.data.city;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 md:top-20">
      {/* Map: top of the screen on mobile, right of the panel on desktop. */}
      <div className="absolute inset-x-0 top-0 bottom-[42dvh] lg:inset-y-0 lg:left-[400px] lg:right-0">
        {city ? (
          <WalkMap centre={city.centre} walk={data} scenic={scenic} selected={selected} pins={pins} />
        ) : (
          <MapSkeleton />
        )}
      </div>

      <aside
        aria-label="Walk planner"
        className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[24px] border-t border-line bg-sand shadow-[0_-8px_24px_rgba(30,42,50,0.08)] transition-[height] duration-300 ease-out lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-[400px] lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-none ${
          sheetOpen ? "h-[calc(100%-48px)]" : "h-[42dvh]"
        }`}
      >
        <button
          type="button"
          onClick={() => setSheetOpen((open) => !open)}
          aria-expanded={sheetOpen}
          aria-label={sheetOpen ? "Collapse walk details" : "Expand walk details"}
          className="flex h-7 shrink-0 items-center justify-center lg:hidden"
        >
          <span className="h-1 w-10 rounded-full bg-ink/15" />
        </button>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8 lg:px-6 lg:pt-8">
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.01em] text-ink">
            Walk {city?.name ?? ""}
          </h1>
          <p className="mt-1 text-[15px] leading-[22px] text-muted">
            The fastest way, or the one with the most to see.
          </p>

          {usingSaved && (
            <p role="status" className="mt-4 rounded-control bg-primary-tint/60 px-3.5 py-2.5 text-[13px] text-ink">
              Showing saved routes. Live data is unavailable right now.
            </p>
          )}

          {error && !options ? (
            <ErrorNote message={error} />
          ) : !options || !pair ? (
            <PanelSkeleton withPickers />
          ) : (
            <>
              <PlacePickers pairs={options.data.pairs} pairId={pair.id} onChange={setPairId} />

              {error ? (
                <ErrorNote message={error} />
              ) : !data || !fastest ? (
                <PanelSkeleton />
              ) : (
                <div className={loadingWalk ? "opacity-60 transition-opacity" : ""} aria-busy={loadingWalk}>
                  <h2 className="mt-6 text-[13px] text-muted">{pair.label}</h2>
                  <RouteCards
                    fastest={fastest}
                    scenic={scenic}
                    selected={selected}
                    onSelect={setSelected}
                  />
                  <BudgetSlider budgets={options.data.budgets} value={budget ?? 0} onChange={setBudget} />
                  <AlongTheWay walk={data} route={scenic ?? fastest} poisById={poisById} />
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function PanelSkeleton({ withPickers = false }: { withPickers?: boolean }) {
  return (
    <div aria-busy aria-label="Loading walks" className="mt-6 space-y-3">
      {withPickers && (
        <>
          <div className="h-12 animate-pulse rounded-control bg-surface" />
          <div className="h-12 animate-pulse rounded-control bg-surface" />
        </>
      )}
      <div className="h-24 animate-pulse rounded-card bg-surface" />
      <div className="h-28 animate-pulse rounded-card bg-surface" />
      <div className="h-32 animate-pulse rounded-card bg-surface" />
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-6 rounded-control border border-line bg-surface p-4 text-[15px] text-ink">
      {message}. Please try again in a moment.
    </p>
  );
}
