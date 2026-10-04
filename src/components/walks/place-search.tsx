"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { searchPlaces, type PlaceResult } from "@/lib/geocode";
import type { RoutePoint } from "@/lib/routing-api";
import type { City } from "@/lib/walks";

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

type Props = {
  label: string;
  icon: ReactNode;
  placeholder: string;
  city: City;
  value: RoutePoint | null;
  onChange: (point: RoutePoint | null) => void;
  disabled?: boolean;
};

/** Place search with autocomplete (Photon), limited to the selected city. */
export function PlaceSearch({ label, icon, placeholder, city, value, onChange, disabled }: Props) {
  const id = useId();
  const listId = `${id}-results`;
  // What the user is typing; null shows the selected place's name instead.
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [found, setFound] = useState<{ query: string; items: PlaceResult[]; error?: string } | null>(null);

  // A new value from outside (map click, drag, suggested walk, city change) replaces any draft.
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setDraft(null);
    setOpen(false);
  }

  const query = (draft ?? "").trim();
  useEffect(() => {
    if (draft === null || query.length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query, city.bbox, city.centre, controller.signal).then(
        (items) => setFound({ query, items }),
        (err: Error) => err.name !== "AbortError" && setFound({ query, items: [], error: err.message }),
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, query, city]);

  const searching = draft !== null && query.length >= MIN_QUERY && found?.query !== query;
  const results = found?.query === query ? found.items : [];
  const showList = open && draft !== null && query.length >= MIN_QUERY && !searching;

  const choose = (place: PlaceResult) => {
    onChange({ name: place.name, lat: place.lat, lng: place.lng });
    setDraft(null);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-[13px] text-muted">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-primary">{icon}</span>
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={draft ?? value?.name ?? ""}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter" && showList && results.length) {
              e.preventDefault();
              choose(results[Math.max(active, 0)]);
            } else if (e.key === "Escape") {
              setDraft(null);
              setOpen(false);
            }
          }}
          className="h-12 w-full rounded-control border border-line bg-surface pr-10 pl-11 text-[15px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted"
        />
        <span className="absolute inset-y-0 right-2 flex items-center">
          {searching ? (
            <LoaderCircle aria-hidden className="mr-1.5 size-4 animate-spin text-muted" />
          ) : (value || draft) && !disabled ? (
            <button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              onClick={() => {
                setDraft(null);
                onChange(null);
              }}
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-sand hover:text-ink"
            >
              <X aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </span>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-control border border-line bg-surface shadow-[0_12px_32px_rgba(30,42,50,0.12)]"
        >
          {found?.error ? (
            <li className="px-4 py-3 text-[13px] text-muted">{found.error}</li>
          ) : results.length === 0 ? (
            <li className="px-4 py-3 text-[13px] text-muted">No places found in {city.name}. Try another name or tap the map.</li>
          ) : (
            results.map((place, i) => (
              <li
                key={place.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't close first
                onClick={() => choose(place)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-primary-tint/60" : ""}`}
              >
                <span className="block text-[15px] text-ink">{place.name}</span>
                {place.area && <span className="block text-[13px] text-muted">{place.area}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
