"use client";

import { useEffect, useRef } from "react";
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";

export type AtlasPolygon = { type: "Feature"; geometry: unknown; properties: { name: string } };
export type AtlasPoint = { type: "Feature"; geometry: { type: "Point"; coordinates: [number, number] }; properties: { number: string; name: string; vitality: string; color: string } };

export default function LinguisticMap({ polygons, points, selectedNumber, onSelect }: { polygons: AtlasPolygon[]; points: AtlasPoint[]; selectedNumber: string | null; onSelect: (number: string) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const callback = useRef(onSelect);
  const dataRef = useRef({ polygons, points, selectedNumber });
  useEffect(() => { callback.current = onSelect; }, [onSelect]);
  useEffect(() => { dataRef.current = { polygons, points, selectedNumber }; }, [polygons, points, selectedNumber]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({ container: container.current, style: "mapbox://styles/mapbox/light-v11", center: [122.2, 12.35], zoom: 4.25, minZoom: 3.5, maxZoom: 12, attributionControl: true, dragRotate: false, pitchWithRotate: false });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");
    map.on("load", () => {
      const initial = dataRef.current;
      map.addSource("atlas-areas", { type: "geojson", data: { type: "FeatureCollection", features: initial.polygons } as never });
      map.addLayer({ id: "atlas-area-fill", type: "fill", source: "atlas-areas", paint: { "fill-color": "#155d68", "fill-opacity": .32 } });
      map.addLayer({ id: "atlas-area-line", type: "line", source: "atlas-areas", paint: { "line-color": "#0f4b55", "line-width": 1.4, "line-opacity": .82 } });
      map.addSource("atlas-points", { type: "geojson", data: { type: "FeatureCollection", features: initial.points } as never });
      map.addLayer({ id: "atlas-point-halo", type: "circle", source: "atlas-points", paint: { "circle-radius": ["case", ["==", ["get", "number"], initial.selectedNumber ?? ""], 10, 6], "circle-color": "#fffdf7", "circle-opacity": .9 } });
      map.addLayer({ id: "atlas-points-layer", type: "circle", source: "atlas-points", paint: { "circle-radius": ["case", ["==", ["get", "number"], initial.selectedNumber ?? ""], 7, 4], "circle-color": ["get", "color"], "circle-stroke-color": "#2a2925", "circle-stroke-width": .55 } });
      map.on("mouseenter", "atlas-points-layer", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "atlas-points-layer", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "atlas-points-layer", (event) => { const number = event.features?.[0]?.properties?.number; if (number) callback.current(String(number)); });
      map.fitBounds([[116.1, 4.25], [127.2, 21.45]], { padding: 34, duration: 0 });
    });
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    (map.getSource("atlas-areas") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: polygons } as never);
    (map.getSource("atlas-points") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: points } as never);
    if (map.getLayer("atlas-point-halo")) map.setPaintProperty("atlas-point-halo", "circle-radius", ["case", ["==", ["get", "number"], selectedNumber ?? ""], 10, 6]);
    if (map.getLayer("atlas-points-layer")) map.setPaintProperty("atlas-points-layer", "circle-radius", ["case", ["==", ["get", "number"], selectedNumber ?? ""], 7, 4]);
  }, [polygons, points, selectedNumber]);

  return <div ref={container} className="atlas-map-canvas" role="region" aria-label="Interactive map of the languages of the Philippines" />;
}
