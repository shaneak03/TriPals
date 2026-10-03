"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { isSight, loadWalk, type WalkFile, type WalkIndex } from "@/lib/walks";
import { AlongTheWay, BudgetSlider, PlacePickers, RouteCards } from "./walk-panel";
import type { RouteKind } from "./walk-map";

// MapLibre needs the DOM and WebGL, so the map only renders in the browser.
const WalkMap = dynamic(() => import("./walk-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#F3EEE6]" />,
});

const DEFAULT_BUDGET = 10;

export function WalkPlanner({ index }: { index: WalkIndex }) {
  const [pairId, setPairId] = useState(index.pairs[0].id);
  const [budget, setBudget] = useState(index.budgets.includes(DEFAULT_BUDGET) ? DEFAULT_BUDGET : index.budgets[0]);
  const [selected, setSelected] = useState<RouteKind>("scenic");
  const [walk, setWalk] = useState<WalkFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let live = true;
    loadWalk(pairId).then(
      (data) => live && (setWalk(data), setError(null)),
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [pairId]);

  const scenic = walk?.scenic[String(budget)] ?? null;
  const poisById = useMemo(() => new Map(walk?.pois.map((p) => [p.id, p])), [walk]);
  const shownRoute = selected === "scenic" ? scenic : walk?.fastest;
  const pins = useMemo(
    () => (shownRoute?.poi_ids ?? []).map((id) => poisById.get(id)!).filter(isSight),
    [shownRoute, poisById],
  );

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 md:top-20">
      {/* Map: top of the screen on mobile, right of the panel on desktop. */}
      <div className="absolute inset-x-0 top-0 bottom-[42dvh] lg:inset-y-0 lg:left-[400px] lg:right-0">
        <WalkMap walk={walk} scenic={scenic} selected={selected} pins={pins} />
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
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.01em] text-ink">Walk Milan</h1>
          <p className="mt-1 text-[15px] leading-[22px] text-muted">
            The fastest way, or the one with the most to see.
          </p>

          <PlacePickers pairs={index.pairs} pairId={pairId} onChange={setPairId} />

          {error ? (
            <p role="alert" className="mt-6 rounded-control border border-line bg-surface p-4 text-[15px] text-ink">
              {error}. Try another walk.
            </p>
          ) : walk && scenic ? (
            <div className={walk.id === pairId ? "" : "opacity-60 transition-opacity"} aria-busy={walk.id !== pairId}>
              <RouteCards
                fastest={walk.fastest}
                scenic={scenic}
                selected={selected}
                onSelect={setSelected}
              />
              <BudgetSlider budgets={index.budgets} value={budget} onChange={setBudget} />
              <AlongTheWay walk={walk} route={scenic} poisById={poisById} />
            </div>
          ) : (
            <div aria-busy className="mt-6 space-y-3">
              <div className="h-28 animate-pulse rounded-card bg-surface" />
              <div className="h-28 animate-pulse rounded-card bg-surface" />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
