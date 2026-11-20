'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl, { type GeoJSONSource } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { type Filters, getData, number, params, type ColorMode, mapPalette, colorModeLabel } from './data';

type MapResult = { clustered: boolean; truncated: boolean; colorBy: ColorMode; categories: string[]; rows: { id?: string; component?: string; longitude: number; latitude: number; points?: number; contracts?: number; status?: string; type?: string; year?: string; mix?: number[] }[] };
export default function ProjectMap({ colorBy = 'status', filters, regionBounds, provinceBounds, cityBounds, onSelect }: { colorBy?: ColorMode; filters: Filters; regionBounds: Record<string, [number, number, number, number]>; provinceBounds?: Record<string, [number, number, number, number]>; cityBounds?: [number, number, number, number]; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null), mapRef = useRef<mapboxgl.Map | null>(null), select = useRef(onSelect), currentFilters = useRef(filters), currentMode = useRef(colorBy), currentCityBounds = useRef(cityBounds);
  const refreshRef = useRef<() => void>(() => {});
  const [message, setMessage] = useState('Loading map…'), [error, setError] = useState('');
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current || !token) return;
    mapboxgl.accessToken = token;
    let map: mapboxgl.Map;
    try { map = new mapboxgl.Map({ container: container.current, style: 'mapbox://styles/mapbox/light-v11', center: [122, 12.3], zoom: 5, minZoom: 4, maxZoom: 17, maxBounds: [[114, 2], [130, 24]], attributionControl: true, dragRotate: false, pitchWithRotate: false }); }
    catch { queueMicrotask(() => setError('This browser could not start the interactive map. The contract register remains available below.')); return; }
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.touchZoomRotate.disableRotation();
    let controller: AbortController | null = null, timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      popup.remove();
      controller?.abort();
      const request = new AbortController(); controller = request;
      const bounds = map.getBounds(); if (!bounds || !map.getSource('projects')) return;
      setMessage('Updating visible locations…'); setError('');
      // Remove old-filter pins immediately so they cannot be mistaken for new results.
      (map.getSource('projects') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      const search = params(currentFilters.current);
      search.set('colorBy', currentMode.current);
      search.set('bounds', [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',')); search.set('zoom', String(map.getZoom()));
      getData<MapResult>(`/api/dpwh/map?${search}`, request.signal).then(data => {
        if (request.signal.aborted) return;
        const palette = mapPalette(data.colorBy);
        const features = data.rows.map((row, i) => {
          const ringId = `distribution-${i}`;
          if (data.clustered) {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 80;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#fcfaf6'; ctx.beginPath(); ctx.arc(40, 40, 32, 0, Math.PI * 2); ctx.fill();
              let angle = -Math.PI / 2;
              (row.mix ?? []).forEach((count, category) => {
                if (!count) return;
                const end = angle + 2 * Math.PI * count / (row.points ?? 1);
                ctx.beginPath(); ctx.arc(40, 40, 31, angle, end); ctx.lineWidth = 12; ctx.strokeStyle = palette[data.categories[category]] ?? '#96938b'; ctx.stroke(); angle = end;
              });
              ctx.fillStyle = '#332c27'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 17px Arial';
              ctx.fillText(new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(row.points ?? 1), 40, 41);
              const pixels = ctx.getImageData(0, 0, 80, 80);
              if (map.hasImage(ringId)) map.updateImage(ringId, pixels); else map.addImage(ringId, pixels, { pixelRatio: 2 });
            }
          }
          const description = data.clustered ? `${number(row.points ?? 0)} locations\n${data.categories.map((category, index) => `${category}: ${number(row.mix?.[index] ?? 0)}`).join('\n')}` : `${row.id} · ${row[data.colorBy]}`;
          return { type: 'Feature' as const, id: i, geometry: { type: 'Point' as const, coordinates: [row.longitude, row.latitude] }, properties: { id: row.id ?? '', grouped: data.clustered, count: row.points ?? 1, ring: ringId, description, color: palette[row[data.colorBy] ?? ''] ?? '#96938b' } };
        });
        (map.getSource('projects') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
        const total = data.rows.reduce((sum, row) => sum + (row.points ?? 1), 0);
        setMessage(!data.rows.length ? 'No published locations in this view.' : `${number(total)} component locations${data.truncated ? ' shown · Zoom in to see more' : ' represented in this view'}${data.clustered ? ' · Select a group to zoom in' : ' · Select a pin for its contract'}`);
      }).catch(e => { if (!request.signal.aborted) { setMessage(''); setError(e.message); } });
    };
    refreshRef.current = refresh;
    map.on('load', () => {
      map.addSource('projects', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'project-circles', type: 'circle', source: 'projects', filter: ['==', ['get', 'grouped'], false], paint: { 'circle-color': ['get', 'color'], 'circle-radius': 6, 'circle-opacity': 0.9, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      map.addLayer({ id: 'project-rings', type: 'symbol', source: 'projects', filter: ['==', ['get', 'grouped'], true], layout: { 'icon-image': ['get', 'ring'], 'icon-size': ['interpolate', ['linear'], ['get', 'count'], 1, 0.8, 1000, 1.1, 10000, 1.5], 'icon-allow-overlap': false } });
      const bounds = currentCityBounds.current ?? provinceBounds?.[currentFilters.current.province ?? 'All'] ?? regionBounds[currentFilters.current.region];
      if (bounds) map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 55, duration: 0, maxZoom: 11 });
      refresh();
    });
    map.on('moveend', () => { clearTimeout(timer); timer = setTimeout(refresh, 180); });
    map.on('error', () => setError('The map could not load completely. Check your connection or use the contract register below.'));
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: true, maxWidth: '280px' });
    for (const layer of ['project-circles', 'project-rings']) {
      map.on('mouseenter', layer, e => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = e.features?.[0] as unknown as { geometry: { type: string; coordinates: number[] }; properties?: { description?: string; grouped?: boolean; id?: string } } | undefined;
        if (feature?.geometry.type !== 'Point') return;
        const content = document.createElement('div'); content.className = 'dpwh-map-hover'; content.textContent = String(feature.properties?.description ?? '');
        popup.setLngLat(feature.geometry.coordinates as [number, number]).setDOMContent(content).addTo(map);
      });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; popup.remove(); });
      map.on('click', layer, e => {
        popup.remove();
        const feature = e.features?.[0] as unknown as { geometry: { type: string; coordinates: number[] }; properties?: { description?: string; grouped?: boolean; id?: string } } | undefined;
        if (!feature || feature.geometry.type !== 'Point') return;
        if (feature.properties?.grouped) map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom: Math.min(17, map.getZoom() + 2), duration: 450 });
        else if (feature.properties?.id) select.current(String(feature.properties.id));
      });
    }
    return () => { clearTimeout(timer); controller?.abort(); popup.remove(); map.remove(); mapRef.current = null; };
  }, [token, regionBounds, provinceBounds]);
  useEffect(() => {
    currentFilters.current = filters;
    currentMode.current = colorBy;
    refreshRef.current();
  }, [filters, colorBy]);
  useEffect(() => {
    currentCityBounds.current = cityBounds;
    const map = mapRef.current;
    const bounds = cityBounds ?? provinceBounds?.[filters.province ?? 'All'] ?? regionBounds[filters.region] ?? [116, 4.5, 127, 21];
    map?.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 45, maxZoom: 11, duration: 500 });
  }, [filters.region, filters.province, regionBounds, provinceBounds, cityBounds]);
  return <div className="dpwh-map-shell"><div className="dpwh-map-toolbar"><span>Rings show category shares · Numbers count locations</span><button onClick={() => mapRef.current?.fitBounds([[116, 4.5], [127, 21]], { padding: 30, duration: 500 })}>Reset map view ↺</button></div><div className="dpwh-map-canvas" ref={container} role="region" aria-label="Interactive Philippines project map. Use the contract register for keyboard-accessible project details." />
    <div className="dpwh-map-feedback" role={error || !token ? 'alert' : 'status'}>{!token ? 'The map access token is not configured. You can still explore every contract in the register below.' : error || message}{token && error && <button onClick={() => refreshRef.current()}>Try again</button>}</div>
    <div className="dpwh-map-legend"><span>Rings and dots by {colorModeLabel[colorBy].toLowerCase()}</span>{Object.entries(mapPalette(colorBy)).map(([status, color]) => <span key={status}><i style={{ background: color }} />{status}</span>)}</div>
  </div>;
}
