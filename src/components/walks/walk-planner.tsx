"use client";

import { Flag, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { reverseGeocode } from "@/lib/geocode";
import { fetchRoute, getLiveCities, RoutingError, type RoutePoint } from "@/lib/routing-api";
import {
  isSight,
  loadCities,
  loadWalk,
  loadWalkOptions,
  type City,
  type DataSource,
  type Loaded,
  type WalkFile,
  type WalkOptions,
  type WalkPair,
} from "@/lib/walks";
import { PlaceSearch } from "./place-search";
import { AlongTheWay, BudgetSlider, CitySelect, RouteCards, SuggestedWalks } from "./walk-panel";
import type { RouteKind } from "./walk-map";

// MapLibre needs the DOM and WebGL, so the map only renders in the browser.
const WalkMap = dynamic(() => import("./walk-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-[#F3EEE6]" />;
}

const PINNED = "Pinned location";

type Result = { key: string; walk: WalkFile; source: DataSource | "api" };

/** null = API unreachable or not configured; undefined = still checking. */
type LiveCities = Set<string> | null | undefined;

export function WalkPlanner({ defaultCityId }: { defaultCityId: string }) {
  const [cities, setCities] = useState<Loaded<City[]> | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [liveCities, setLiveCities] = useState<LiveCities>(undefined);
  const [options, setOptions] = useState<Loaded<WalkOptions> | null>(null);
  const [start, setStart] = useState<RoutePoint | null>(null);
  const [end, setEnd] = useState<RoutePoint | null>(null);
  const [pairId, setPairId] = useState<string | null>(null); // set while a suggested walk is shown
  const [result, setResult] = useState<Result | null>(null);
  const [routeError, setRouteError] = useState<{ key: string; message: string } | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [selected, setSelected] = useState<RouteKind>("scenic");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [suggestedOnce, setSuggestedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cities (Supabase, or the saved list) and which of them the routing API serves.
  useEffect(() => {
    let live = true;
    loadCities().then(
      (loaded) => {
        if (!live) return;
        setCities(loaded);
        setCityId((id) => id ?? (loaded.data.find((c) => c.id === defaultCityId) ?? loaded.data[0])?.id ?? null);
      },
      (err: Error) => live && setError(err.message),
    );
    getLiveCities().then((ids) => live && setLiveCities(ids));
    return () => {
      live = false;
    };
  }, [defaultCityId]);

  // Suggested walks and time budgets for the selected city.
  useEffect(() => {
    if (!cityId) return;
    let live = true;
    loadWalkOptions(cityId).then(
      (loaded) => {
        if (!live) return;
        setOptions(loaded);
        const { budgets, pairs } = loaded.data;
        setBudget((b) => b ?? (budgets.find((t) => t.is_default) ?? budgets[0])?.minutes ?? 0);
        // Open the page on the first suggested walk, so it isn't empty on arrival.
        if (!suggestedOnce && pairs[0]) {
          setSuggestedOnce(true);
          setStart(placeOf(pairs[0].start));
          setEnd(placeOf(pairs[0].end));
          setPairId(pairs[0].id);
        }
      },
      (err: Error) => live && setError(err.message),
    );
    return () => {
      live = false;
    };
  }, [cityId, suggestedOnce]);

  const city = cities?.data.find((c) => c.id === cityId) ?? null;
  const cityOptions = options?.data.city.id === cityId ? options : null;
  const isLive = !!cityId && !!liveCities?.has(cityId);
  const canPick = isLive; // free start/destination needs the routing API

  // One request per (suggested walk | start + destination); names don't change the route.
  const routeKey = pairId ? `pair:${pairId}` : start && end ? `${start.lat},${start.lng}|${end.lat},${end.lng}` : null;
  const sLat = start?.lat, sLng = start?.lng, eLat = end?.lat, eLng = end?.lng;

  useEffect(() => {
    if (!routeKey || !cityId) return;
    let live = true;
    const done = (walk: WalkFile, source: Result["source"]) => live && setResult({ key: routeKey, walk, source });
    const fail = (message: string) => live && setRouteError({ key: routeKey, message });

    if (pairId) {
      loadWalk(cityId, pairId).then((l) => done(l.data, l.source), (err: Error) => fail(err.message));
    } else if (isLive && sLat !== undefined && sLng !== undefined && eLat !== undefined && eLng !== undefined) {
      fetchRoute({ name: "", lat: sLat, lng: sLng }, { name: "", lat: eLat, lng: eLng }).then(
        (walk) => done(walk, "api"),
        (err: RoutingError) => {
          if (err.status === 0 && live) setLiveCities(null); // API went away: switch to saved walks
          fail(err.message);
        },
      );
    }
    return () => {
      live = false;
    };
  }, [routeKey, cityId, pairId, isLive, sLat, sLng, eLat, eLng]);

  const walk = result?.key === routeKey ? result.walk : null;
  const loading = !!routeKey && !walk && routeError?.key !== routeKey;
  const failure = routeError?.key === routeKey ? routeError.message : null;

  const fastest = walk?.fastest ?? null;
  // A budget added in the dashboard has no scenic route until the pipeline reruns.
  const scenic = (budget !== null && walk?.scenic[String(budget)]) || null;
  const poisById = useMemo(() => new Map(walk?.pois.map((p) => [p.id, p])), [walk]);
  const shownRoute = selected === "scenic" && scenic ? scenic : fastest;
  const pins = useMemo(
    () => (shownRoute?.poi_ids ?? []).flatMap((id) => poisById.get(id) ?? []).filter(isSight),
    [shownRoute, poisById],
  );

  // --- input handlers: start and destination never change each other -----------------

  const changeCity = (id: string) => {
    setCityId(id);
    setStart(null);
    setEnd(null);
    setPairId(null);
  };

  const pickPair = (pair: WalkPair) => {
    setStart(placeOf(pair.start));
    setEnd(placeOf(pair.end));
    setPairId(pair.id);
  };

  const nameLater = useCallback((which: "start" | "end", lat: number, lng: number) => {
    reverseGeocode(lat, lng).then((name) => {
      if (!name) return;
      const rename = (p: RoutePoint | null) => (p && p.lat === lat && p.lng === lng ? { ...p, name } : p);
      (which === "start" ? setStart : setEnd)(rename);
    });
  }, []);

  const setPoint = useCallback(
    (which: "start" | "end", point: RoutePoint | null) => {
      (which === "start" ? setStart : setEnd)(point);
      setPairId(null);
      if (point?.name === PINNED) nameLater(which, point.lat, point.lng);
    },
    [nameLater],
  );

  const onMapPick = useCallback(
    (lat: number, lng: number) => {
      // First click sets the start, the next the destination; after that, clicks move the destination.
      setPoint(!start ? "start" : "end", { name: PINNED, lat, lng });
    },
    [start, setPoint],
  );
  const onMoveStart = useCallback((lat: number, lng: number) => setPoint("start", { name: PINNED, lat, lng }), [setPoint]);
  const onMoveEnd = useCallback((lat: number, lng: number) => setPoint("end", { name: PINNED, lat, lng }), [setPoint]);

  const savedData =
    cities?.source === "saved" || cityOptions?.source === "saved" || result?.source === "saved";
  const pair = cityOptions?.data.pairs.find((p) => p.id === pairId) ?? null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 md:top-20">
      {/* Map: top of the screen on mobile, right of the panel on desktop. */}
      <div className="absolute inset-x-0 top-0 bottom-[42dvh] lg:inset-y-0 lg:left-[400px] lg:right-0">
        {city ? (
          <WalkMap
            city={city}
            walk={walk}
            scenic={scenic}
            selected={selected}
            pins={pins}
            start={start}
            end={end}
            onPick={canPick ? onMapPick : undefined}
            onMoveStart={canPick ? onMoveStart : undefined}
            onMoveEnd={canPick ? onMoveEnd : undefined}
          />
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

          {error && !cities ? (
            <ErrorNote message={`${error}. Please try again in a moment.`} />
          ) : !cities || !city ? (
            <PanelSkeleton withInputs />
          ) : (
            <>
              <div className="mt-6 space-y-3">
                <CitySelect cities={cities.data} value={city.id} onChange={changeCity} />
                <PlaceSearch
                  label="Start"
                  icon={<MapPin aria-hidden className="size-5" strokeWidth={1.75} />}
                  placeholder={canPick ? "Search a place or tap the map" : "Pick a suggested walk below"}
                  city={city}
                  value={start}
                  onChange={(p) => setPoint("start", p)}
                  disabled={!canPick}
                />
                <PlaceSearch
                  label="Destination"
                  icon={<Flag aria-hidden className="size-5" strokeWidth={1.75} />}
                  placeholder={canPick ? "Search a place or tap the map" : "Pick a suggested walk below"}
                  city={city}
                  value={end}
                  onChange={(p) => setPoint("end", p)}
                  disabled={!canPick}
                />
                {canPick && <p className="text-[12px] text-muted">Place search by Photon · © OpenStreetMap contributors</p>}
              </div>

              <SuggestedWalks pairs={cityOptions?.data.pairs ?? []} activeId={pairId} onPick={pickPair} />

              <StatusNote liveCities={liveCities} isLive={isLive} cityName={city.name} savedData={savedData} />

              {failure ? (
                <ErrorNote message={failure} />
              ) : loading ? (
                <PanelSkeleton />
              ) : !walk || !fastest || !start || !end ? (
                <EmptyState start={start} end={end} canPick={canPick} />
              ) : (
                <>
                  <h2 className="mt-6 text-[13px] text-muted">
                    {pair?.label ?? `${start.name} to ${end.name}`}
                  </h2>
                  <RouteCards fastest={fastest} scenic={scenic} poisById={poisById} selected={selected} onSelect={setSelected} />
                  {cityOptions && (
                    <BudgetSlider budgets={cityOptions.data.budgets} value={budget ?? 0} onChange={setBudget} />
                  )}
                  <AlongTheWay startName={start.name} endName={end.name} route={scenic ?? fastest} poisById={poisById} />
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

const placeOf = (p: { name: string; lat: number; lng: number }): RoutePoint => ({ name: p.name, lat: p.lat, lng: p.lng });

function StatusNote({
  liveCities,
  isLive,
  cityName,
  savedData,
}: {
  liveCities: LiveCities;
  isLive: boolean;
  cityName: string;
  savedData: boolean;
}) {
  let message: string | null = null;
  if (liveCities === null) message = "Live routing is offline; showing saved walks.";
  else if (liveCities && !isLive) message = `Live routing isn't available for ${cityName} yet; try a suggested walk.`;
  else if (savedData) message = "Showing saved routes. Live data is unavailable right now.";
  if (!message) return null;
  return (
    <p role="status" className="mt-4 rounded-control bg-primary-tint/60 px-3.5 py-2.5 text-[13px] text-ink">
      {message}
    </p>
  );
}

function EmptyState({ start, end, canPick }: { start: RoutePoint | null; end: RoutePoint | null; canPick: boolean }) {
  const text = !canPick
    ? "Pick a suggested walk to compare the fastest route with the one that has the most to see."
    : !start && !end
      ? "Search for a start and a destination, or tap the map to drop them."
      : !start
        ? "Now pick where you're starting from."
        : "Now pick where you're going.";
  return <p className="mt-6 rounded-card border border-dashed border-line p-5 text-[15px] text-muted">{text}</p>;
}

function PanelSkeleton({ withInputs = false }: { withInputs?: boolean }) {
  return (
    <div aria-busy aria-label="Loading" className="mt-6 space-y-3">
      {withInputs && (
        <>
          <div className="h-12 animate-pulse rounded-control bg-surface" />
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
      {message}
    </p>
  );
}
