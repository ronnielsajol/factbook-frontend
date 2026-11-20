"use client";

import { useEffect, useRef } from "react";
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";

export type MapHover = { recordId: string; eyebrow: string; label: string; value: number; share: number; registeredVoters?: number };
export type MapFeature = {
  type: "Feature";
  id: string | number;
  geometry: unknown;
  properties: {
    recordId: string;
    eyebrow: string;
    label: string;
    value: number;
    share: number;
    fill: string;
    opacity: number;
    registeredVoters?: number;
  };
};

type Props = {
  accessToken?: string;
  ariaLabel: string;
  features: MapFeature[];
  selectedId: string | null;
  onHover: (hovered: MapHover | null) => void;
  onSelect: (id: string) => void;
  onClear: () => void;
  focusId?: string | null;
  highlightedIds?: string[];
};

const sourceId = "factbook-geographies";
const fillId = "factbook-fill";
const lineId = "factbook-line";
const initialBounds: [[number, number], [number, number]] = [[116.1, 4.25], [127.2, 21.45]];

export default function MapboxChoropleth({ accessToken, ariaLabel, features, selectedId, onHover, onSelect, onClear, focusId, highlightedIds = [] }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const callbacksRef = useRef({ onHover, onSelect, onClear });
  callbacksRef.current = { onHover, onSelect, onClear };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = accessToken || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [122.1, 12.3],
      zoom: 4.25,
      minZoom: 3.4,
      maxZoom: 12,
      attributionControl: true,
      cooperativeGestures: false,
      pitchWithRotate: false,
      dragRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-left");
    const resetControl = {
      container: null as HTMLDivElement | null,
      onAdd() {
        const container = document.createElement("div");
        container.className = "mapboxgl-ctrl mapboxgl-ctrl-group factbook-map-reset";
        const button = document.createElement("button");
        button.type = "button";
        button.title = "Reset map view";
        button.setAttribute("aria-label", "Reset map view");
        button.innerHTML = '<span aria-hidden="true">↺</span>';
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          map.fitBounds(initialBounds, { padding: 38, duration: 600 });
        });
        container.appendChild(button);
        this.container = container;
        return container;
      },
      onRemove() {
        this.container?.remove();
        this.container = null;
      },
    };
    map.addControl(resetControl, "top-left");

    map.on("load", () => {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features } as never });
      map.addLayer({
        id: fillId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": ["get", "fill"],
          "fill-opacity": highlightedIds.length ? ["case", ["in", ["get", "recordId"], ["literal", highlightedIds]], 0.95, 0.18] : ["get", "opacity"],
        },
      });
      map.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": ["case", ["any", ["==", ["get", "recordId"], selectedId ?? "__none__"], ["in", ["get", "recordId"], ["literal", highlightedIds]]], "#172725", "#f7f4eb"],
          "line-width": ["case", ["any", ["==", ["get", "recordId"], selectedId ?? "__none__"], ["in", ["get", "recordId"], ["literal", highlightedIds]]], 2.2, 0.85],
          "line-opacity": 0.95,
        },
      });
      map.fitBounds(initialBounds, { padding: 38, duration: 0 });
    });

    map.on("mousemove", (event) => {
      if (!map.getLayer(fillId)) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: [fillId] })[0];
      const props = feature?.properties;
      if (!props?.recordId) {
        map.getCanvas().style.cursor = "";
        callbacksRef.current.onHover(null);
        return;
      }
      map.getCanvas().style.cursor = "pointer";
      callbacksRef.current.onHover({
        recordId: String(props.recordId),
        eyebrow: String(props.eyebrow ?? ""),
        label: String(props.label ?? ""),
        value: Number(props.value ?? 0),
        share: Number(props.share ?? 0),
        registeredVoters: props.registeredVoters ? Number(props.registeredVoters) : undefined,
      });
    });
    map.on("mouseleave", () => {
      map.getCanvas().style.cursor = "";
      callbacksRef.current.onHover(null);
    });
    map.on("click", (event) => {
      if (!map.getLayer(fillId)) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: [fillId] })[0];
      const id = feature?.properties?.recordId;
      if (id) callbacksRef.current.onSelect(String(id));
      else callbacksRef.current.onClear();
    });

    const clearFromOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        callbacksRef.current.onHover(null);
        callbacksRef.current.onClear();
      }
    };
    document.addEventListener("pointerdown", clearFromOutside);

    return () => {
      document.removeEventListener("pointerdown", clearFromOutside);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features } as never);
    if (map.getLayer(fillId)) {
      map.setPaintProperty(fillId, "fill-opacity", highlightedIds.length ? ["case", ["in", ["get", "recordId"], ["literal", highlightedIds]], 0.95, 0.18] : ["get", "opacity"]);
    }
    if (map.getLayer(lineId)) {
      map.setPaintProperty(lineId, "line-color", ["case", ["any", ["==", ["get", "recordId"], selectedId ?? "__none__"], ["in", ["get", "recordId"], ["literal", highlightedIds]]], "#172725", "#f7f4eb"]);
      map.setPaintProperty(lineId, "line-width", ["case", ["any", ["==", ["get", "recordId"], selectedId ?? "__none__"], ["in", ["get", "recordId"], ["literal", highlightedIds]]], 2.2, 0.85]);
    }
  }, [features, selectedId, highlightedIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const feature = features.find((item) => item.properties.recordId === focusId);
    if (!feature) return;
    const bounds = new mapboxgl.LngLatBounds();
    const addCoordinates = (coordinates: unknown) => {
      if (!Array.isArray(coordinates)) return;
      if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
        bounds.extend([coordinates[0], coordinates[1]] as [number, number]);
        return;
      }
      coordinates.forEach(addCoordinates);
    };
    addCoordinates((feature.geometry as { coordinates?: unknown }).coordinates);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 74, maxZoom: 9.5, duration: 700 });
  }, [features, focusId]);

  return <div ref={containerRef} className="mapbox-canvas" role="region" aria-label={ariaLabel} />;
}
