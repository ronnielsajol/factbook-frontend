"use client";

import { useEffect, useRef } from "react";
import mapboxgl, { type Map as MapboxMap } from "mapbox-gl";

export type ForeignPost = {
  id: string;
  city: string;
  country: string;
  longitude: number;
  latitude: number;
  type: string;
  directoryTitle: string;
  directoryLines: string[];
  headOfPost: string;
  headTitle: string;
  addressLines: string[];
  contactLines: string[];
};

const colors: Record<string, string> = {
  Embassy: "#173f68",
  "Consulate General": "#d68c2f",
  "Permanent Mission to ASEAN": "#9b3c52",
  "Permanent Mission to the UN and other international organizations": "#9b3c52",
  "Permanent Mission to the UN": "#9b3c52",
  "Permanent Mission to the WTO": "#9b3c52",
};

export default function ForeignServiceMap({ posts, selectedId, onSelect }: { posts: ForeignPost[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const selectRef = useRef(onSelect);

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/light-v11",
      projection: "mercator",
      center: [0, 15],
      zoom: 0.8,
      minZoom: 0.5,
      maxZoom: 8,
      attributionControl: true,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.fitBounds([[-179, -58], [179, 78]], { padding: 24, duration: 0 });
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type === "symbol" && layer.layout?.["text-field"]) {
          map.setLayoutProperty(layer.id, "text-size", ["interpolate", ["linear"], ["zoom"], 0, 12, 3, 13, 6, 15]);
        }
      }
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = posts.map((post) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `fsp-map-marker ${post.id === selectedId ? "selected" : ""}`;
      element.style.setProperty("--marker-color", colors[post.type] ?? colors["Permanent Mission to the UN"]);
      const isSelected = post.id === selectedId;
      element.setAttribute("aria-label", `${isSelected ? "Deselect" : "Select"} ${post.type} in ${post.city}, ${post.country}`);
      element.setAttribute("aria-pressed", String(isSelected));
      element.addEventListener("click", () => selectRef.current(isSelected ? null : post.id));
      return new mapboxgl.Marker({ element, anchor: "center" }).setLngLat([post.longitude, post.latitude]).addTo(map);
    });
  }, [posts, selectedId]);

  useEffect(() => {
    const selected = posts.find((post) => post.id === selectedId);
    if (selected && mapRef.current) mapRef.current.easeTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(mapRef.current.getZoom(), 3.2), duration: 700 });
    else if (!selectedId && mapRef.current) mapRef.current.fitBounds([[-179, -58], [179, 78]], { padding: 24, duration: 500 });
  }, [selectedId, posts]);

  return <div ref={container} className="fsp-map" role="region" aria-label="Interactive world map of Philippine foreign service posts" />;
}
