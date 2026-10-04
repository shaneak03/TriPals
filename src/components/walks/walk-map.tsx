"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import { Flag } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { iconFor } from "@/lib/walk-icons";
import type { LineString, Poi, Route, WalkFile } from "@/lib/walks";

// Served from public/ by scripts/copy-maplibre-worker.mjs (bundlers break MapLibre's own lookup).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Free, keyless vector basemap. Only routes and pins carry colour.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const COLORS = { fast: "#B8C2C9", scenic: "#FF7A59" };
const FADE_MS = 180;

// Warm the grey positron base towards the sand palette.
const BASEMAP_TINT: [layer: string, property: "background-color" | "fill-color", color: string][] = [
  ["background", "background-color", "#FAF7F2"],
  ["landuse_residential", "fill-color", "#F3EEE6"],
  ["building", "fill-color", "#EDE7DD"],
  ["park", "fill-color", "#E4EFEA"],
  ["water", "fill-color", "#D3E3E5"],
];

export type RouteKind = "fastest" | "scenic";

type Props = {
  centre: [lng: number, lat: number]; // initial view, before a walk loads
  walk: WalkFile | null;
  scenic: Route | null;
  selected: RouteKind;
  pins: Poi[];
};

const asFeature = (geometry: LineString) => ({ type: "Feature" as const, properties: {}, geometry });
const EMPTY = { type: "FeatureCollection" as const, features: [] };

export default function WalkMap({ centre, walk, scenic, selected, pins }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    const m = new MapLibreMap({
      container: containerRef.current!,
      style: STYLE_URL,
      center: centre,
      zoom: 13.5,
      attributionControl: { compact: true },
    });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    // "style.load", not "load": "load" waits for every visible tile, so one slow tile
    // request would keep the routes and markers from ever appearing.
    m.once("style.load", () => {
      for (const [layer, property, color] of BASEMAP_TINT) {
        if (m.getLayer(layer)) m.setPaintProperty(layer, property, color);
      }
      m.addSource("fastest", { type: "geojson", data: EMPTY });
      m.addSource("scenic", { type: "geojson", data: EMPTY, lineMetrics: true });
      m.addLayer({
        id: "fastest",
        type: "line",
        source: "fastest",
        layout: { "line-join": "round" },
        paint: {
          "line-color": COLORS.fast,
          "line-width": 4,
          "line-dasharray": [1.5, 1.25],
          "line-opacity-transition": { duration: FADE_MS },
        },
      });
      m.addLayer({
        id: "scenic",
        type: "line",
        source: "scenic",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": COLORS.scenic,
          "line-width": 5,
          "line-opacity-transition": { duration: FADE_MS },
        },
      });
      setMap(m);
    });
    return () => m.remove();
  }, [centre]);

  // Fastest route: whenever the walk changes.
  useEffect(() => {
    if (!map) return;
    const fastest = walk?.fastest;
    map.getSource<GeoJSONSource>("fastest")?.setData(fastest ? asFeature(fastest.geometry) : EMPTY);
  }, [map, walk]);

  // Scenic route: fade out, swap geometry, fade back in.
  const scenicKey = useRef<LineString | null>(null);
  const selectedRef = useRef(selected); // read by the fade timer, which can outlive a selection change
  useEffect(() => {
    if (!map || !walk?.fastest) return;
    const fastest = walk.fastest;
    const source = map.getSource<GeoJSONSource>("scenic");
    const frame = (lines: LineString[]) => {
      const bounds = new LngLatBounds();
      for (const line of lines) for (const c of line.coordinates) bounds.extend(c);
      map.fitBounds(bounds, { padding: 56, duration: 600, maxZoom: 16.5 });
    };
    if (!scenic) {
      // No scenic route for this budget yet (pipeline not rerun): show the fastest only.
      scenicKey.current = null;
      source?.setData(EMPTY);
      frame([fastest.geometry]);
      return;
    }
    const first = scenicKey.current === null;
    scenicKey.current = scenic.geometry;
    if (first) {
      source?.setData(asFeature(scenic.geometry));
    } else {
      map.setPaintProperty("scenic", "line-opacity", 0);
    }
    const timer = window.setTimeout(() => {
      source?.setData(asFeature(scenic.geometry));
      map.setPaintProperty("scenic", "line-opacity", selectedRef.current === "scenic" ? 1 : 0.35);
    }, first ? 0 : FADE_MS);

    frame([fastest.geometry, scenic.geometry]);
    return () => window.clearTimeout(timer);
  }, [map, walk, scenic]);

  // Highlight the selected route: full opacity and drawn on top.
  useEffect(() => {
    selectedRef.current = selected;
    if (!map) return;
    map.setPaintProperty("scenic", "line-opacity", selected === "scenic" ? 1 : 0.35);
    map.setPaintProperty("fastest", "line-opacity", selected === "fastest" ? 1 : 0.8);
    map.setPaintProperty("fastest", "line-width", selected === "fastest" ? 5 : 4);
    map.moveLayer(selected === "fastest" ? "fastest" : "scenic");
  }, [map, selected]);

  return (
    <div className="size-full">
      {/* MapLibre forces position: relative on this element, so size it directly. */}
      <div ref={containerRef} className="size-full" />
      {map && walk && (
        <>
          <MapMarker map={map} lng={walk.start.lng} lat={walk.start.lat} title={walk.start.name} subtitle="Start">
            <span className="block size-[18px] rounded-full border-[5px] border-ink bg-white shadow-card" />
          </MapMarker>
          <MapMarker map={map} lng={walk.end.lng} lat={walk.end.lat} title={walk.end.name} subtitle="Destination">
            <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white ring-2 ring-white shadow-card">
              <Flag aria-hidden className="size-4" strokeWidth={1.75} />
            </span>
          </MapMarker>
          {pins.map((poi) => {
            const Icon = iconFor(poi.icon);
            return (
              <MapMarker key={poi.id} map={map} lng={poi.lng} lat={poi.lat} title={poi.name} subtitle={poi.category_label}>
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white ring-2 ring-white shadow-card">
                  <Icon aria-hidden className="size-3.5" strokeWidth={2} />
                </span>
              </MapMarker>
            );
          })}
        </>
      )}
    </div>
  );
}

/** A MapLibre marker whose content is React, with a click popup showing title + subtitle. */
function MapMarker({
  map,
  lng,
  lat,
  title,
  subtitle,
  children,
}: {
  map: MapLibreMap;
  lng: number;
  lat: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  // Only ever rendered client-side, after the map has loaded.
  const [element] = useState(() => document.createElement("div"));

  useEffect(() => {
    const content = document.createElement("div");
    const name = content.appendChild(document.createElement("p"));
    name.className = "map-popup-title";
    name.textContent = title;
    const meta = content.appendChild(document.createElement("p"));
    meta.className = "map-popup-meta";
    meta.textContent = subtitle;

    const marker = new Marker({ element })
      .setLngLat([lng, lat])
      .setPopup(new Popup({ offset: 16, closeButton: false, maxWidth: "240px" }).setDOMContent(content))
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, element, lng, lat, title, subtitle]);

  return createPortal(
    <button type="button" aria-label={`${title} (${subtitle})`} className="block cursor-pointer">
      {children}
    </button>,
    element,
  );
}
