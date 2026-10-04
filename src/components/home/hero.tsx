"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Coins, MapPin, PlaneTakeoff, User, type LucideIcon } from "lucide-react";
import heroImage from "../../../public/images/hero-milan.jpg";
import type { Journey } from "@/lib/journeys/types";

type SearchField = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  span: string;
};

type City = { id: string; name: string; code: string; countryCode?: string | null; coordinates?: { latitude: number; longitude: number } | null };

export function Hero() {
  const [from, setFrom] = useState("London");
  const [to, setTo] = useState("Milan");
  const [cities, setCities] = useState<City[]>([]);
  const [date, setDate] = useState("2026-11-12");
  const [travellers, setTravellers] = useState("1");
  const [currency, setCurrency] = useState<"GBP" | "EUR">("GBP");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCurrencyChange(nextCurrency: "GBP" | "EUR") {
    if (nextCurrency === currency) return;
    if (journeys.length === 0) {
      setCurrency(nextCurrency);
      return;
    }

    try {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/${nextCurrency.toLowerCase()}`);
      if (!response.ok) throw new Error("Unable to convert currency");
      const payload = (await response.json()) as { rate: number };
      const rate = payload.rate;
      setJourneys((current) => current.map((journey) => ({
        ...journey,
        totalPriceMinor: Math.round(journey.totalPriceMinor * rate),
        currency: nextCurrency,
        legs: journey.legs.map((leg) => ({
          ...leg,
          priceMinor: Math.round(leg.priceMinor * rate),
          currency: nextCurrency,
        })),
      })));
      setCurrency(nextCurrency);
    } catch {
      setError("Unable to convert the displayed prices. Please try again.");
    }
  }

  useEffect(() => {
    fetch("/api/locations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load cities");
        return response.json();
      })
      .then((payload) => setCities(payload.cities ?? []))
      .catch(() => setError("Unable to load cities. Check your Supabase connection."));
  }, []);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch("/api/journeys/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { name: from, code: cities.find((city) => city.name === from)?.code, coordinates: cities.find((city) => city.name === from)?.coordinates ?? undefined },
          destination: { name: to, code: cities.find((city) => city.name === to)?.code, coordinates: cities.find((city) => city.name === to)?.coordinates ?? undefined },
          departureDate: date,
          travellers: Number(travellers),
          currency,
          modes: ["flight", "train", "coach"],
          optimiseFor: "value",
        }),
      });

      if (!response.ok || !response.body) throw new Error("Search failed");
      setJourneys([]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as { type: string; journeys?: Journey[]; error?: string };
          if (message.type === "journeys") {
            setJourneys((current) => sortJourneys([...current, ...(message.journeys ?? [])]));
          }
          if (message.type === "error") throw new Error(message.error ?? "Search failed");
        }
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed");
      setJourneys([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section className="relative isolate">
      <div className="relative h-[560px] overflow-hidden lg:h-[640px]">
        <Image
          src={heroImage}
          alt="Sunlit street of old townhouses with flower-filled balconies"
          fill
          sizes="100vw"
          quality={90}
          placeholder="blur"
          loading="eager"
          fetchPriority="high"
          className="-z-20 object-cover object-center"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent" />
        <div className="mx-auto flex h-full w-full max-w-[1200px] items-end px-5 pb-14 lg:px-8 lg:pb-20">
        <div className="max-w-[780px]">
          <h1 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] text-white sm:text-[48px] lg:text-[56px]">
            The cheapest flight isn&apos;t the cheapest trip.
          </h1>
          <p className="mt-4 max-w-[620px] text-lg leading-relaxed text-white/80">
            See what your trip really costs door to door, then walk the route with the most to see.
          </p>
        </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-5 pb-12 lg:px-8 lg:pb-16">
        <form onSubmit={handleSearch} className="mt-8 grid grid-cols-2 items-center gap-2 rounded-card bg-surface p-4 shadow-card sm:gap-4 sm:p-6 lg:grid-cols-12 lg:p-8">
          <CitySelect cities={cities} icon={PlaneTakeoff} label="From" value={from} onChange={setFrom} hint="European city" span="col-span-2 lg:col-span-3" />
          <CitySelect cities={cities} icon={MapPin} label="To" value={to} onChange={setTo} hint="European city" span="col-span-2 lg:col-span-2" />
          <label className="col-span-1 flex min-w-0 items-center gap-3.5 rounded-control p-3 lg:col-span-2">
            <CalendarDays aria-hidden className="size-[22px] shrink-0 text-primary" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted">Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full bg-transparent font-semibold text-ink outline-none" />
            </span>
          </label>
          <label className="col-span-1 flex min-w-0 items-center gap-3.5 rounded-control p-3 lg:col-span-2">
            <Coins aria-hidden className="size-[22px] shrink-0 text-primary" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted">Currency</span>
              <select value={currency} onChange={(event) => void handleCurrencyChange(event.target.value as "GBP" | "EUR")} className="w-full bg-transparent font-semibold text-ink outline-none">
                <option value="GBP">GBP (£)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </span>
          </label>
          <label className="col-span-1 flex min-w-0 items-center gap-3.5 rounded-control p-3 lg:col-span-2">
            <User aria-hidden className="size-[22px] shrink-0 text-primary" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-muted">Travellers</span>
              <input type="number" min="1" max="9" value={travellers} onChange={(event) => setTravellers(event.target.value)} className="w-full bg-transparent font-semibold text-ink outline-none" />
            </span>
          </label>
          <button type="submit" disabled={isSearching} className="col-span-2 flex h-14 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-accent px-4 font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70 lg:col-span-2">
            {isSearching ? "Searching…" : "Find true cost"}
            {!isSearching && <ArrowRight aria-hidden className="size-[18px]" strokeWidth={1.75} />}
          </button>
        </form>

        {error && <p role="alert" className="mt-3 rounded-control bg-accent-tint px-4 py-3 text-sm text-ink">{error}</p>}
        {journeys.length > 0 && <JourneyResults journeys={journeys} currency={currency} />}
      </div>
    </section>
  );
}

function CitySelect({ cities, icon: Icon, label, value, onChange, hint, span }: SearchField & { cities: City[]; onChange: (value: string) => void }) {
  return (
    <label className={`${span} flex min-w-0 items-center gap-3.5 rounded-control p-3`}>
      <Icon aria-hidden className="size-[22px] shrink-0 text-primary" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-muted">{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent font-semibold text-ink outline-none">
          {cities.length === 0 && <option>Loading cities…</option>}
          {cities.map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}
        </select>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function JourneyResults({ journeys, currency }: { journeys: Journey[]; currency: string }) {
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-3" aria-live="polite">
      {journeys.map((journey) => (
        <article key={journey.id} className="rounded-card bg-surface p-5 text-ink shadow-card">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium capitalize text-primary">{journey.type} route</span>
            <span className="text-right text-xl font-semibold tabular-nums">
              {journey.priceUnavailable ? "Fare unavailable" : `${currencySymbol(currency)}${(journey.totalPriceMinor / 100).toFixed(2)}`}
            </span>
          </div>
          <p className="mt-1 text-xs capitalize text-muted">{journey.priceSource} pricing</p>
          {journey.type === "flight" && journey.legs.some((leg) => leg.mode === "airport_transfer") && (
            <div className="mt-4 rounded-control bg-accent-tint p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Door-to-door cost</p>
              <div className="mt-2 space-y-1 text-sm text-ink">
                {journey.legs.filter((leg) => leg.mode === "flight" || leg.mode === "airport_transfer").map((leg, index) => (
                  <div key={`${journey.id}-cost-${index}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">{leg.mode === "flight" ? "Flight" : `${leg.origin} → ${leg.destination}`}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{currencySymbol(leg.currency)}{(leg.priceMinor / 100).toFixed(2)}{leg.isEstimatedPrice ? " est." : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">{formatDuration(journey.totalDurationMinutes)} · {journey.transferCount} transfers</p>
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            {journey.legs.map((leg, index) => (
              <div key={`${journey.id}-${index}`} className="rounded-control bg-sand p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{leg.mode.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted">{formatDuration(leg.durationMinutes, leg.mode === "flight" && leg.durationMinutes > 120)}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-ink">
                  {leg.origin} <span className="text-muted">→</span> {leg.destination}
                </p>
                {(leg.operator || leg.serviceNumber) && (
                  <p className="mt-1 text-xs text-muted">
                    {leg.operator ?? "Transport service"}{leg.serviceNumber ? ` · ${leg.serviceNumber}` : ""}
                  </p>
                )}
                <p className="mt-2 text-sm font-semibold tabular-nums text-ink">
                  {leg.isEstimatedPrice && leg.priceMinor === 0
                    ? "Fare unavailable"
                    : `${currencySymbol(leg.currency)}${(leg.priceMinor / 100).toFixed(2)}${leg.isEstimatedPrice ? " estimated" : ""}`}
                </p>
                {(leg.departureAt || leg.arrivalAt) && (
                  <p className="mt-1 text-xs tabular-nums text-muted">
                    {formatDateTime(leg.departureAt)}{leg.arrivalAt ? ` → ${formatDateTime(leg.arrivalAt)}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function sortJourneys(journeys: Journey[]) {
  return journeys.sort((a, b) => {
    if (a.priceUnavailable !== b.priceUnavailable) return a.priceUnavailable ? 1 : -1;
    if (!a.priceUnavailable && a.totalPriceMinor !== b.totalPriceMinor) return a.totalPriceMinor - b.totalPriceMinor;
    return a.totalDurationMinutes - b.totalDurationMinutes;
  });
}

function currencySymbol(currency: string) {
  return currency === "EUR" ? "€" : "£";
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(minutes: number, useHours = false) {
  if (!useHours && minutes < 120) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}

