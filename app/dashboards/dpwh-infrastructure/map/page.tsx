'use client';
import Distribution from './Distribution';
import { lazy, Suspense, useState } from 'react';
import { ContractProfile, Explorer, Modal, useRemote } from '../components';
import { type Filters, type Snapshot, emptyFilters, number, params, type ColorMode, colorModeLabel, mapPalette, switchMapMode } from '../data';

const unclassifiedNote = "No infrastructure type was provided in the captured DPWH contract or component fields. Project descriptions may still identify the nature of the work.";
const ProjectMap = lazy(() => import('../ProjectMap'));
const initialFilters: Filters = { ...emptyFilters, province: 'All', city: 'All' };
type Options = { cityRegions?: string[]; provinces: string[]; provinceRegions: Record<string, string[]>; provinceBounds: Record<string, [number, number, number, number]> };
type City = { id: string; name: string; kind: string; region: string; province: string | null; bounds: [number, number, number, number]; contracts: number };
export default function MapPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [colorBy, setColorBy] = useState<ColorMode>('status');
  const [selected, setSelected] = useState<string | null>(null);
  const [classificationInfo, setClassificationInfo] = useState(false);
  const [retry, setRetry] = useState(0);
  const { data: snapshot, error } = useRemote<Snapshot>(`/api/dpwh/summary?retry=${retry}`);
  const { data: options, error: optionsError } = useRemote<Options>(`/api/dpwh/map-options?geography=city-index-v1&retry=${retry}`);
  const { data: totals, error: totalsError } = useRemote<{ contracts: number; mapped: number }>(`/api/dpwh/map-summary?${params(filters)}&retry=${retry}`);
  const { data: cityResult, error: cityError } = useRemote<{ cities: City[] }>(`/api/dpwh/city-options?region=${encodeURIComponent(filters.region)}&province=${encodeURIComponent(filters.province ?? 'All')}&revision=2&retry=${retry}`);
  const chosenCity = cityResult?.cities.find(city => city.id === filters.city);
  const change = (field: keyof Filters, value: string) => setFilters(current => ({ ...current, [field]: value, ...(field === 'region' ? { province: 'All', city: 'All' } : field === 'province' ? { city: 'All' } : {}) }));
  const provinces = options?.provinces.filter(p => filters.region === 'All' || options.provinceRegions[p].includes(filters.region)) ?? [];
  const categories = snapshot ? colorBy === 'year' ? snapshot.years : colorBy === 'type' ? snapshot.types : snapshot.statuses : [];
  const showing = [`Colored by ${colorModeLabel[colorBy].toLowerCase()}`, filters[colorBy] === 'All' ? 'All categories' : filters[colorBy], filters.region === 'All' ? 'All regions' : filters.region, filters.province === 'All' ? 'All provinces' : filters.province, filters.city === 'All' ? 'All cities / municipalities' : chosenCity?.name ?? 'Selected city / municipality'].join(' · ');
  return <main className="dpwh-page dpwh-map-page" id="top">
    <header className="dpwh-nav"><a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a><nav aria-label="Map page navigation"><a href="/dashboards/dpwh-infrastructure">← Back to dashboard</a><a href="#map-projects">Matching contracts</a><a href="/dashboards/dpwh-infrastructure#sources">Sources &amp; history</a></nav></header>
    <section className="dpwh-map-intro"><p className="dpwh-eyebrow">Infrastructure · 8 September 2026 snapshot</p><h1>DPWH project map</h1><p>These filters apply only to this map and its matching contract list.</p></section>
    {(error || optionsError) && <p className="dpwh-message" role="alert">{error || optionsError} <button onClick={() => setRetry(retry + 1)}>Try again</button></p>}
    {!error && !optionsError && (!snapshot || !options) && <p className="dpwh-message" role="status">Loading map controls…</p>}
    {snapshot && options && <>
      <div className="dpwh-map-workspace">
        <aside className="dpwh-map-controls" aria-label="Map filters">
          <div className="dpwh-map-controls-heading"><h2>Map filters</h2><button className="dpwh-reset" onClick={() => setFilters({ ...initialFilters })}>Clear all ↺</button></div>
          <fieldset className="dpwh-color-modes"><legend>Color map by</legend>{(['status', 'year', 'type'] as ColorMode[]).map(mode => <label className="dpwh-map-status-option" key={mode}><input type="radio" name="map-color-mode" checked={colorBy === mode} onChange={() => { setColorBy(mode); setFilters(current => switchMapMode(current)); }} />{colorModeLabel[mode]}</label>)}</fieldset>
          <fieldset className="dpwh-map-categories"><legend>{colorModeLabel[colorBy]}</legend><label className="dpwh-map-status-option"><input type="radio" name="map-category" checked={filters[colorBy] === 'All'} onChange={() => change(colorBy, 'All')} />Show all</label>{categories.map(category => <div className="dpwh-map-category-row" key={category}><label className="dpwh-map-status-option"><input type="radio" name="map-category" checked={filters[colorBy] === category} onChange={() => change(colorBy, category)} /><i style={{ background: mapPalette(colorBy)[category] ?? '#70655d' }} aria-hidden="true" />{category === 'On-Going' ? 'Ongoing' : category}</label>{colorBy === 'type' && category === 'Unclassified' && <button className="dpwh-info-button" aria-label="What does Unclassified mean?" onClick={() => setClassificationInfo(true)}>ⓘ</button>}</div>)}</fieldset>
          <label className="dpwh-map-select">Region<select value={filters.region} onChange={e => change('region', e.target.value)}><option value="All">All regions</option>{[...new Set([...snapshot.regions, ...(options.cityRegions ?? [])])].sort().map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="dpwh-map-select">Province<select disabled={!provinces.length} value={filters.province} onChange={e => change('province', e.target.value)}><option value="All">{filters.region === 'National Capital Region' ? 'Not applicable to NCR' : provinces.length ? 'All provinces' : 'No province options'}</option>{provinces.map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="dpwh-map-select">City / Municipality<select disabled={filters.region === 'All' || !cityResult || !!cityError} value={filters.city} onChange={e => {
            const city = cityResult?.cities.find(city => city.id === e.target.value);
            setFilters(current => ({ ...current, city: e.target.value, ...(city && !city.province ? { province: 'All' } : {}) }));
          }}><option value="All">{filters.region === 'All' ? 'Select a region first' : !cityResult ? 'Loading places…' : 'All cities / municipalities'}</option>{cityResult?.cities.map(city => <option key={city.id} value={city.id}>{city.name}{city.kind === 'HUC' || city.kind === 'ICC' ? ` · ${city.kind}` : ''}{!city.contracts ? ' · no identified records' : ''}</option>)}</select></label>
          {cityError && <p className="dpwh-note" role="alert">{cityError} <button onClick={() => setRetry(retry + 1)}>Try again</button></p>}

        </aside>
        <div className="dpwh-map-results"><div className="dpwh-map-selection" aria-live="polite"><p><strong>Showing:</strong> {showing}</p>{totalsError ? <p role="alert">{totalsError} <button onClick={() => setRetry(retry + 1)}>Try again</button></p> : totals ? <p><strong>{number(totals.contracts)} matching contracts</strong> · {number(totals.mapped)} with map locations · {number(totals.contracts - totals.mapped)} without coordinates</p> : <p role="status">Updating matching counts…</p>}</div>
          <Suspense fallback={<p className="dpwh-message" role="status">Loading interactive map…</p>}><ProjectMap colorBy={colorBy} filters={filters} regionBounds={snapshot.regionBounds} provinceBounds={options.provinceBounds} cityBounds={chosenCity?.bounds} onSelect={setSelected} /></Suspense>
          <p className="dpwh-note">Coordinates come directly from the DPWH Transparency Portal and are displayed as published.</p>
          <details className="dpwh-map-about"><summary>About the map and data</summary><div>
            <section><h2>Locations and geographic filters</h2><p>Some published coordinates may not match the stated project location and have not been independently verified.</p><p>City matches are identified from DPWH descriptions, not coordinates. Ambiguous or unnamed locations are unassigned, so city results may be incomplete.</p><p>Province choices follow administrative geography; NCR has cities and a municipality, not provinces. Results use DPWH’s region and component province labels, which may differ from a pin’s actual location.</p><p>HUC means highly urbanized city; ICC means independent component city.</p></section>
            <section><h2>Pins and contract counts</h2><p>Pins represent component locations, not project boundaries. Several pins may belong to one contract. The matching count includes contracts without coordinates; map circles show locations in the current view.</p><p>Each contract counts once. The pie chart follows active filters.</p><p>Only one color mode is active. Switching modes clears the previous category selection.</p></section>
            <section><h2>Infrastructure classifications</h2><p><strong>What does “Unclassified” mean?</strong> {unclassifiedNote}</p></section>
          </div></details>
        </div>
        <Distribution filters={filters} colorBy={colorBy} unmapped={totals ? totals.contracts - totals.mapped : null} />
      </div>
      <div id="map-projects"><Explorer filters={filters} onSelect={setSelected} mapContext /></div>
    </>}
    <footer className="dpwh-footer"><a href="/dashboards/dpwh-infrastructure">← Back to dashboard</a><span>Infrastructure · DPWH · 8 September 2026 snapshot</span><a href="/dashboards/dpwh-infrastructure#sources">Sources, dates &amp; maintenance history</a></footer>
    {classificationInfo && <Modal title="What does Unclassified mean?" onClose={() => setClassificationInfo(false)}><p>{unclassifiedNote}</p></Modal>}
    {selected && <ContractProfile id={selected} onClose={() => setSelected(null)} />}
  </main>;
}
