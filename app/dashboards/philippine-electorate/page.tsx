"use client";

import { useEffect, useState } from "react";
import MapboxChoropleth, { type MapFeature } from "./MapboxChoropleth";
import voterData from "../../../data/generated/voters-region.json";
import geographyData from "../../../data/generated/voters-geography.json";
import ageGeographyData from "../../../data/generated/voters-age-geography.json";
import provinceBoundaries from "../../../data/generated/philippines-provinces-simplified.json";
import municipalBoundaries from "../../../data/generated/philippines-municipalities-simplified.json";

type Measure = "total" | "male" | "female";
type Layer = "region" | "province" | "municipality";
type Age = { age: string; total: number; male: number; female: number };
type VoterRecord = { name: string; total: number; male: number; female: number; ages?: Age[]; region?: string; province?: string };
type Boundary = { properties: { province?: string; region?: string; name?: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
type Hovered = { eyebrow: string; label: string; value: number };
type Cohort = { label: string; range: string; from: number; to: number; value: number };
type CohortKey = "genZ" | "millennials" | "genX" | "older";
type AgeView = "all" | CohortKey;
type AgeMapRecord = { name: string; region: string; province: string; total: number; cohorts: Record<CohortKey, number> };
type AgeHovered = { eyebrow: string; label: string; value: number; share: number };
type SearchOption<T> = { id: string; label: string; meta: string; record: T };

const mapRegion: Record<string, string> = { NCR: "NATIONAL CAPITAL REGION", CAR: "CORDILLERA ADM. REGION", I: "REGION I", II: "REGION II", III: "REGION III", CALABARZON: "REGION IV-A", MIMAROPA: "REGION IV-B", V: "REGION V", VI: "REGION VI", NIR: "NEGROS ISLAND REGION", VII: "REGION VII", VIII: "REGION VIII", IX: "REGION IX", X: "REGION X", XI: "REGION XI", XII: "REGION XII", XIII: "CARAGA", BARMM: "B A R M M" };
const key = (value = "") => value.toUpperCase().replace(/ - .+$/, "").replace(/^(CITY|MUNICIPALITY) OF /, "").replace(/ CITY$/, "").replace(/[^A-Z0-9]/g, "");
const fmt = new Intl.NumberFormat("en-PH");
const short = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(2)}K` : fmt.format(value);
const legendShort = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}K` : fmt.format(value);
const regions = voterData.regions.slice(1) as VoterRecord[];
const provinces = geographyData.provinces as VoterRecord[];
const localities = geographyData.localities as VoterRecord[];
const provinceByKey = new Map(provinces.map((item) => [key(item.name), item]));
const localityByName = new Map<string, VoterRecord[]>();
for (const item of localities) localityByName.set(key(item.name), [...(localityByName.get(key(item.name)) ?? []), item]);
const regionByName = new Map(regions.map((item) => [item.name, item]));
const ageRegions = ageGeographyData.regions as AgeMapRecord[];
const ageProvinces = ageGeographyData.provinces as AgeMapRecord[];
const ageLocalities = ageGeographyData.localities as AgeMapRecord[];
const ageRegionCodes: Record<string, string> = { NCR: "NCR", CAR: "CAR", I: "Region 1", II: "Region 2", III: "Region 3", CALABARZON: "Region 4A", MIMAROPA: "Region 4B", V: "Region 5", VI: "Region 6", NIR: "NIR", VII: "Region 7", VIII: "Region 8", IX: "Region 9", X: "Region 10", XI: "Region 11", XII: "Region 12", XIII: "CARAGA", BARMM: "BARMM" };
const ageRegionByName = new Map(ageRegions.map((item) => [item.name, item]));
const ageProvinceByKey = new Map(ageProvinces.map((item) => [key(item.name), item]));
const ageLocalityByName = new Map<string, AgeMapRecord[]>();
for (const item of ageLocalities) ageLocalityByName.set(key(item.name), [...(ageLocalityByName.get(key(item.name)) ?? []), item]);
const recordId = (level: Layer | "national", record: VoterRecord) => `${level}:${key(record.region)}:${key(record.province)}:${key(record.name)}`;
const localityFor = (name = "", province = "") => {
  const candidates = localityByName.get(key(name)) ?? [];
  if (candidates.length <= 1) return candidates[0];
  const provinceKey = key(province);
  return candidates.find((item) => key(item.province) === provinceKey || provinceKey.includes(key(item.province))) ?? candidates[0];
};
const cohortDefs = [
  { label: "Ages 18–30", range: "18–30", from: 18, to: 30 },
  { label: "Ages 31–45", range: "31–45", from: 31, to: 45 },
  { label: "Ages 46–59", range: "46–59", from: 46, to: 59 },
  { label: "Ages 60+", range: "60 and older", from: 60, to: Infinity },
];
const cohortsFor = (ages: Age[], measure: Measure): Cohort[] => cohortDefs.map((cohort) => ({ ...cohort, value: ages.filter((item) => { const age = parseInt(item.age, 10); return age >= cohort.from && age <= cohort.to; }).reduce((sum, item) => sum + item[measure], 0) }));
const ageId = (level: Layer, record: AgeMapRecord) => `${level}:${key(record.region)}:${key(record.province)}:${key(record.name)}`;
const ageLocalityFor = (name = "", province = "") => {
  const candidates = ageLocalityByName.get(key(name)) ?? [];
  if (candidates.length <= 1) return candidates[0];
  const provinceKey = key(province);
  return candidates.find((item) => key(item.province) === provinceKey || provinceKey.includes(key(item.province))) ?? candidates[0];
};
const agePalette: Record<CohortKey, string> = { genZ: "#E76F51", millennials: "#E9B949", genX: "#2A9D8F", older: "#6C5B9A" };
const ageLabels: Record<CohortKey, { label: string; range: string }> = { genZ: { label: "Ages 18–30", range: "18–30" }, millennials: { label: "Ages 31–45", range: "31–45" }, genX: { label: "Ages 46–59", range: "46–59" }, older: { label: "Ages 60+", range: "60 and older" } };

function MapSearch<T>({ label, options, onSelect }: { label: string; options: SearchOption<T>[]; onSelect: (option: SearchOption<T>) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalized = query.trim().toLowerCase();
  const matches = normalized ? options.filter((option) => `${option.label} ${option.meta}`.toLowerCase().includes(normalized)).slice(0, 8) : [];
  const submit = () => {
    const match = matches.find((option) => option.label.toLowerCase() === normalized) ?? matches[0];
    if (!match) return;
    setQuery(match.label);
    setOpen(false);
    onSelect(match);
  };
  return <div className="map-search">
    <form onSubmit={(event) => { event.preventDefault(); submit(); }} role="search">
      <label><span className="sr-only">{label}</span><input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={label} autoComplete="off" /></label>
      <button type="submit" aria-label="Search">⌕</button>
    </form>
    {open && normalized && <div className="map-search-results" role="listbox" aria-label="Search results">{matches.length ? matches.map((option) => <button type="button" role="option" aria-selected="false" key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(option.label); setOpen(false); onSelect(option); }}><strong>{option.label}</strong>{option.meta && <small>{option.meta}</small>}</button>) : <p>No matching area</p>}</div>}
  </div>;
}

export default function PhilippineElectorate() {
  const national = voterData.regions[0] as VoterRecord;
  const [selected, setSelected] = useState<VoterRecord>(national);
  const [selectedId, setSelectedId] = useState(recordId("national", national));
  const [measure, setMeasure] = useState<Measure>("total");
  const [layer, setLayer] = useState<Layer>("region");
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [activeSegment, setActiveSegment] = useState("");
  const [ageLayer, setAgeLayer] = useState<Layer>("region");
  const [ageCohort, setAgeCohort] = useState<AgeView>("all");
  const [selectedAgeRecord, setSelectedAgeRecord] = useState<AgeMapRecord | null>(null);
  const [ageHovered, setAgeHovered] = useState<AgeHovered | null>(null);
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  const [activeSection, setActiveSection] = useState("map");
  const [mapFocusId, setMapFocusId] = useState<string | null>(null);
  const [ageMapFocusId, setAgeMapFocusId] = useState<string | null>(null);

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMaintenanceLog(false); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, []);
  useEffect(() => {
    const sections = ["map", "profile", "age-geography", "source"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-76px 0px -55%", threshold: [0, .15, .35] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  const palette = measure === "female" ? "#b94e57" : measure === "male" ? "#173f67" : "#287a8a";
  const cohortTotal = national.total;
  const cohorts = cohortsFor(national.ages ?? [], "total");
  const dominantCohort = cohorts.reduce((a, b) => b.value > a.value ? b : a, cohorts[0]);
  let cohortCursor = 0;
  const cohortGradient = `conic-gradient(${cohorts.map((cohort, index) => { const start = cohortCursor; cohortCursor += cohort.value / cohortTotal * 100; return `${agePalette[(Object.keys(ageLabels) as CohortKey[])[index]]} ${start}% ${cohortCursor}%`; }).join(", ")})`;

  const clearSelection = () => { setSelected(national); setSelectedId(recordId("national", national)); setHovered(null); };
  const choose = (next: VoterRecord, level: Layer) => {
    const nextId = recordId(level, next);
    if (selectedId === nextId) { clearSelection(); return; }
    setSelected(next); setSelectedId(nextId);
  };
  const changeLayer = (next: Layer) => { setLayer(next); setMapFocusId(null); clearSelection(); };

  const mapFeatures = layer === "municipality" ? municipalBoundaries.features as Boundary[] : provinceBoundaries.features as Boundary[];
  const featureRecord = (feature: Boundary) => {
    if (layer === "region") return regionByName.get(mapRegion[feature.properties.region ?? ""]);
    if (layer === "province") return provinceByKey.get(key(feature.properties.province));
    return localityFor(feature.properties.name, feature.properties.province);
  };
  const values = mapFeatures.map(featureRecord).filter(Boolean).map((item) => item![measure]);
  const max = Math.max(...values, 1);
  const binSize = Math.ceil(max / 5);
  const opacitySteps = [.2, .4, .6, .8, 1];
  const legendBins = opacitySteps.map((opacity, index) => ({
    opacity,
    lower: index === 0 ? 0 : index * binSize + 1,
    upper: Math.min((index + 1) * binSize, max),
  }));
  const mapRecordLookup = new Map<string, VoterRecord>();
  const mapboxFeatures: MapFeature[] = mapFeatures.map((feature, index) => {
    const record = featureRecord(feature);
    const fallbackRegion = regionByName.get(mapRegion[feature.properties.region ?? ""]);
    const display = record ?? (layer === "region" ? fallbackRegion : undefined);
    const value = display?.[measure] ?? 0;
    const id = display ? recordId(layer, display) : "";
    if (display) mapRecordLookup.set(id, display);
    return {
      type: "Feature",
      id: index,
      geometry: feature.geometry,
      properties: {
        recordId: id,
        eyebrow: layer === "region" ? display?.name ?? "Region" : layer === "province" ? display?.region ?? "Province" : display?.province ?? "City / municipality",
        label: display?.name ?? "",
        value,
        share: 0,
        fill: display ? palette : "#879792",
        opacity: display ? opacitySteps[Math.min(4, Math.floor(Math.max(value - 1, 0) / binSize))] : .08,
      },
    };
  });
  const breakdownRecords = [...(layer === "region" ? regions : layer === "province" ? provinces : localities)]
    .sort((a, b) => b.total - a.total)
    .slice(0, layer === "municipality" ? 50 : undefined);
  const breakdownMax = breakdownRecords[0]?.total ?? 1;
  const breakdownTitle = layer === "region" ? "Regional breakdown" : layer === "province" ? "Provincial breakdown" : "Top 50 cities & municipalities";
  const searchRecords = layer === "region" ? regions : layer === "province" ? provinces : localities;
  const searchOptions: SearchOption<VoterRecord>[] = searchRecords.map((record) => ({ id: recordId(layer, record), label: record.name, meta: layer === "municipality" ? [record.province, record.region].filter(Boolean).join(" · ") : record.region ?? "", record })).sort((a, b) => a.label.localeCompare(b.label));
  const totalLabel = measure === "total" ? "total registered voters" : `total ${measure} registered voters`;
  const nationalAgeRecord: AgeMapRecord = { name: "Philippines", region: "", province: "", total: national.total, cohorts: { genZ: cohortsFor(national.ages ?? [], "total")[0].value, millennials: cohortsFor(national.ages ?? [], "total")[1].value, genX: cohortsFor(national.ages ?? [], "total")[2].value, older: cohortsFor(national.ages ?? [], "total")[3].value } };
  const ageSelected = selectedAgeRecord ?? nationalAgeRecord;
  const ageMapFeatures = ageLayer === "municipality" ? municipalBoundaries.features as Boundary[] : provinceBoundaries.features as Boundary[];
  const ageFeatureRecord = (feature: Boundary) => {
    if (ageLayer === "region") return ageRegionByName.get(ageRegionCodes[feature.properties.region ?? ""]);
    if (ageLayer === "province") return ageProvinceByKey.get(key(feature.properties.province));
    return ageLocalityFor(feature.properties.name, feature.properties.province);
  };
  const ageViewLabel = ageCohort === "all" ? "All voters" : ageLabels[ageCohort].label;
  const ageColor = ageCohort === "all" ? "#287a8a" : agePalette[ageCohort];
  const ageMapValue = (item: AgeMapRecord) => ageCohort === "all" ? item.total : item.cohorts[ageCohort] / item.total * 100;
  const ageCount = (item: AgeMapRecord) => ageCohort === "all" ? item.total : item.cohorts[ageCohort];
  const ageMapValues = ageMapFeatures.map(ageFeatureRecord).filter(Boolean).map((item) => ageMapValue(item!));
  const ageMin = ageCohort === "all" ? 0 : Math.min(...ageMapValues, 100);
  const ageMax = Math.max(...ageMapValues, 1);
  const ageBinSize = Math.max((ageMax - ageMin) / 5, .01);
  const ageRecordLookup = new Map<string, AgeMapRecord>();
  const ageMapboxFeatures: MapFeature[] = ageMapFeatures.map((feature, index) => {
    const record = ageFeatureRecord(feature);
    const value = record ? ageCount(record) : 0;
    const share = record ? value / record.total * 100 : 0;
    const mapValue = record ? ageMapValue(record) : 0;
    const id = record ? ageId(ageLayer, record) : "";
    if (record) ageRecordLookup.set(id, record);
    return {
      type: "Feature",
      id: index,
      geometry: feature.geometry,
      properties: {
        recordId: id,
        eyebrow: record?.province || record?.region || ageLayer,
        label: record?.name ?? "",
        value,
        share,
        fill: record ? ageColor : "#879792",
        opacity: record ? .22 + Math.min(4, Math.max(0, Math.floor((mapValue - ageMin) / ageBinSize))) * .195 : .07,
      },
    };
  });
  const ageBreakdown = [...(ageLayer === "region" ? ageRegions : ageLayer === "province" ? ageProvinces : ageLocalities)].sort((a, b) => ageCount(b) - ageCount(a)).slice(0, ageLayer === "municipality" ? 50 : undefined);
  const ageBreakdownMax = ageBreakdown[0] ? ageCount(ageBreakdown[0]) : 1;
  const ageSearchRecords = ageLayer === "region" ? ageRegions : ageLayer === "province" ? ageProvinces : ageLocalities;
  const ageSearchOptions: SearchOption<AgeMapRecord>[] = ageSearchRecords.map((record) => ({ id: ageId(ageLayer, record), label: record.name, meta: ageLayer === "municipality" ? [record.province, record.region].filter(Boolean).join(" · ") : record.region ?? "", record })).sort((a, b) => a.label.localeCompare(b.label));
  const selectedAgeDominant = (Object.keys(ageLabels) as CohortKey[]).reduce((a, b) => ageSelected.cohorts[b] > ageSelected.cohorts[a] ? b : a, "genZ");
  const chooseAgeRecord = (record: AgeMapRecord) => setSelectedAgeRecord((current) => current && ageId(ageLayer, current) === ageId(ageLayer, record) ? null : record);

  return <main className="electorate" id="top">
    <header className="dash-nav"><a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a><nav aria-label="Dashboard sections"><a className={activeSection === "map" ? "active" : ""} aria-current={activeSection === "map" ? "location" : undefined} href="#map">Voter Distribution by Region</a><a className={activeSection === "profile" ? "active" : ""} aria-current={activeSection === "profile" ? "location" : undefined} href="#profile">Age Group Composition</a><a className={activeSection === "age-geography" ? "active" : ""} aria-current={activeSection === "age-geography" ? "location" : undefined} href="#age-geography">Age Group Distribution by Region</a><a className={activeSection === "source" ? "active" : ""} aria-current={activeSection === "source" ? "location" : undefined} href="#source">About</a></nav></header>

    <section className="electorate-hero">
      <div><p className="dash-kicker">People &amp; Demography · Election 2025</p><h1>The Philippine<br /><em>electorate.</em></h1><p className="dash-deck">Explore the country’s registered voters by region, age group, and sex ahead of the May 2025 elections.</p></div>
      <div className="hero-stat"><span>Registered voters</span><strong><span className="hero-number" data-full-number={fmt.format(national.total)} tabIndex={0}>{short(national.total)}</span></strong><small>Hover for the full number · as of 23 January 2025</small></div>
    </section>

    <section className="dash-overview" id="map">
      <div className="overview-head">
        <div><p className="dash-kicker">{layer} distribution</p><h2>Where voters are registered</h2></div>
        <div className="map-controls">
          <div className="layer-tabs" aria-label="Geographic layer">{(["region", "province", "municipality"] as Layer[]).map((item) => <button key={item} className={layer === item ? "active" : ""} onClick={() => changeLayer(item)}>{item === "municipality" ? "City / municipality" : item}</button>)}</div>
          <div className={`measure-tabs ${measure}`} aria-label="Measure">{(["total", "female", "male"] as Measure[]).map((item) => <button key={item} className={measure === item ? "active" : ""} onClick={() => setMeasure(item)}>{item === "total" ? "All voters" : item}</button>)}</div>
        </div>
      </div>

      <div className="map-grid">
        <aside className="region-panel">
          <button className="national-reset" onClick={clearSelection}>↖ National view</button><p className="dash-kicker">Selected geography</p><h3>{selected.name}</h3>
          <strong className="region-total"><abbr title={fmt.format(selected[measure])}>{short(selected[measure])}</abbr></strong><span>{totalLabel}</span>
          <div className="sex-split"><div><span>Female</span><b>{fmt.format(selected.female)}</b><i style={{ width: `${selected.female / selected.total * 100}%` }} /></div><div><span>Male</span><b>{fmt.format(selected.male)}</b><i style={{ width: `${selected.male / selected.total * 100}%` }} /></div></div>
          {selected.ages ? <p className="panel-note">Dominant age group: <b>{dominantCohort.label} ({dominantCohort.range})</b>, with <b>{fmt.format(dominantCohort.value)}</b> voters.</p> : <p className="panel-note">Age-group detail is shown nationally below; this map layer focuses on geographic totals and sex.</p>}
        </aside>

        <aside className="breakdown-panel" aria-label={breakdownTitle}>
          <div className="breakdown-head"><p className="dash-kicker">Geographic comparison</p><h3>{breakdownTitle}</h3><p>{breakdownRecords.length} {layer === "municipality" ? "highest-registration localities" : layer === "province" ? "province-level entries" : "regions"}, ranked by total registered voters.</p>{layer === "province" && <p className="breakdown-disclosure">Includes 82 provinces and the BARMM Special Geographic Area. NCR has no provinces and is therefore not ranked in this view.</p>}</div>
          <div className="breakdown-key"><span><i className="female" />Female</span><span><i className="male" />Male</span></div>
          <div className="breakdown-list">{breakdownRecords.map((item, index) => {
            const id = recordId(layer, item);
            return <div role="button" tabIndex={0} key={id} className={`breakdown-row ${selectedId === id ? "active" : ""}`} onClick={() => choose(item, layer)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(item, layer); } }} title={`${item.name}: ${fmt.format(item.total)} registered voters`}>
              <span className="breakdown-rank">{String(index + 1).padStart(2, "0")}</span><span className="breakdown-name">{item.name}</span><b>{short(item.total)}</b>
              <span className="stack-track"><i style={{ width: `${item.total / breakdownMax * 100}%` }}>
                {(["female", "male"] as const).map((sex) => { const segmentId = `${id}:${sex}`; return <em key={sex} className={`${sex} ${activeSegment === segmentId ? "active" : ""}`} style={{ width: `${item[sex] / item.total * 100}%` }} data-value={`${sex[0].toUpperCase() + sex.slice(1)} · ${fmt.format(item[sex])}`} role="button" tabIndex={0} aria-label={`${item.name}, ${sex}: ${fmt.format(item[sex])}`} onClick={(event) => { event.stopPropagation(); setActiveSegment(activeSegment === segmentId ? "" : segmentId); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setActiveSegment(activeSegment === segmentId ? "" : segmentId); } }} />; })}
              </i></span>
            </div>;
          })}</div>
        </aside>

        <div className={`geo-map mapbox-map ${measure} ${layer}`} aria-label={`Map by ${layer}`}>
          <MapSearch key={`voter-search-${layer}`} label={`Search ${layer === "municipality" ? "city or municipality" : layer}`} options={searchOptions} onSelect={(option) => { choose(option.record, layer); setMapFocusId(option.id); }} />
          <MapboxChoropleth ariaLabel={`Philippine registered voters by ${layer}, ${measure}`} features={mapboxFeatures} selectedId={selectedId} focusId={mapFocusId} onHover={(item) => setHovered(item ? { eyebrow: item.eyebrow, label: item.label, value: item.value } : null)} onSelect={(id) => { const record = mapRecordLookup.get(id); if (record) choose(record, layer); }} onClear={clearSelection} />
          {hovered && <div className={`map-tooltip ${measure}`} style={{ backgroundColor: palette }}><span>{hovered.eyebrow}</span><b>{hovered.label}</b><strong>{fmt.format(hovered.value)}</strong><small>{measure === "total" ? "registered voters" : `${measure} registered voters`}</small></div>}
          <div className="map-legend" aria-label="Registered voter ranges">{legendBins.map((bin) => <div key={bin.lower}><i style={{ backgroundColor: palette, opacity: bin.opacity }} /><span>{legendShort(bin.lower)}–{legendShort(bin.upper)}</span></div>)}</div>
        </div>
      </div>
    </section>

    <section className="profile-section" id="profile">
      <div className="profile-copy"><p className="dash-kicker">National age profile</p><h2>Four age groups,<br />one electorate.</h2><p>This chart shows the nationwide share of registered voters in four broad age groups.</p></div>
      <div className="profile-viz cohort-pie-layout">
        <div className="cohort-pie" style={{ background: cohortGradient }} role="img" aria-label="National age-group composition"><div><strong>{short(cohortTotal)}</strong><span>registered voters</span></div></div>
        <div className="cohort-pie-key">{cohorts.map((cohort, index) => { const cohortKey = (Object.keys(ageLabels) as CohortKey[])[index]; return <section key={cohort.label}><i style={{ backgroundColor: agePalette[cohortKey] }} /><div><strong>{cohort.label}</strong><small>{cohort.range}</small></div><b>{(cohort.value / cohortTotal * 100).toFixed(1)}%</b><span>{short(cohort.value)}</span></section>; })}<p>Largest age group: <strong>{dominantCohort.label}</strong></p></div>
      </div>
    </section>

    <section className="age-map-section" id="age-geography">
      <div className="age-map-head"><div><p className="dash-kicker">Age-group geography</p><h2>Where age groups<br />shape the electorate</h2></div><div className="age-map-controls"><div className="layer-tabs" aria-label="Geographic layer">{(["region", "province", "municipality"] as Layer[]).map((item) => <button type="button" key={item} className={ageLayer === item ? "active" : ""} onClick={() => { setAgeLayer(item); setAgeMapFocusId(null); setSelectedAgeRecord(null); }}>{item === "municipality" ? "City / municipality" : item}</button>)}</div><div className="age-cohort-tabs" aria-label="Age group">{(["all", ...Object.keys(ageLabels)] as AgeView[]).map((item) => <button type="button" key={item} className={ageCohort === item ? "active" : ""} style={ageCohort === item ? { backgroundColor: item === "all" ? "#123f49" : agePalette[item] } : undefined} onClick={() => setAgeCohort(item)}>{item === "all" ? "All voters" : ageLabels[item].label}</button>)}</div></div></div>
      <div className="age-map-grid">
        <aside className="age-map-selected"><button type="button" onClick={() => setSelectedAgeRecord(null)}>↖ National view</button><p className="dash-kicker">Selected age profile</p><h3>{ageSelected.name}</h3><p className="age-map-primary"><span>{ageViewLabel}</span><strong>{ageCohort === "all" ? short(ageSelected.total) : `${(ageSelected.cohorts[ageCohort] / ageSelected.total * 100).toFixed(1)}%`}</strong><small>{fmt.format(ageCount(ageSelected))} registered voters</small></p><div className="age-map-profile">{(Object.keys(ageLabels) as CohortKey[]).map((item) => <section key={item}><i style={{ backgroundColor: agePalette[item] }} /><span>{ageLabels[item].label}<small>{ageLabels[item].range}</small></span><strong>{(ageSelected.cohorts[item] / ageSelected.total * 100).toFixed(1)}%<small>{short(ageSelected.cohorts[item])}</small></strong></section>)}</div><p className="age-map-dominant">Largest age group: <b>{ageLabels[selectedAgeDominant].label}</b></p></aside>
        <aside className="age-map-ranking"><div><p className="dash-kicker">Geographic comparison</p><h3>{ageLayer === "municipality" ? "Top 50 cities & municipalities" : ageLayer === "province" ? "Provincial breakdown" : "Regional breakdown"}</h3><p>{ageCohort === "all" ? "Ranked by total registered voters. Stacked bars show each area’s age composition." : `Ranked by total ${ageViewLabel} registered voters. Percentage shows their share of each area’s electorate.`}</p>{ageLayer === "province" && <p className="breakdown-disclosure">Includes 82 provinces and the BARMM Special Geographic Area. NCR has no provinces and is excluded.</p>}{ageCohort === "all" && <div className="age-stack-key">{(Object.keys(ageLabels) as CohortKey[]).map((item) => <span key={item}><i style={{ backgroundColor: agePalette[item] }} />{ageLabels[item].label}</span>)}</div>}</div><div className="age-ranking-list">{ageBreakdown.map((item, index) => { const value = ageCount(item); const share = ageCohort === "all" ? 100 : value / item.total * 100; return <button type="button" key={ageId(ageLayer, item)} onClick={() => chooseAgeRecord(item)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><b>{short(value)}</b><i className={ageCohort === "all" ? "stacked" : ""} style={{ width: `${value / ageBreakdownMax * 100}%` }}>{ageCohort === "all" ? (Object.keys(ageLabels) as CohortKey[]).map((cohort) => <em key={cohort} style={{ width: `${item.cohorts[cohort] / item.total * 100}%`, backgroundColor: agePalette[cohort] }} />) : <em style={{ width: "100%", backgroundColor: ageColor }} />}</i><small>{ageCohort === "all" ? "100%" : `${share.toFixed(1)}%`}</small></button>; })}</div></aside>
        <div className="age-geo-map mapbox-map">
          <MapSearch key={`age-search-${ageLayer}`} label={`Search ${ageLayer === "municipality" ? "city or municipality" : ageLayer}`} options={ageSearchOptions} onSelect={(option) => { setSelectedAgeRecord(option.record); setAgeMapFocusId(option.id); }} />
          <MapboxChoropleth ariaLabel={`${ageViewLabel} by ${ageLayer}`} features={ageMapboxFeatures} selectedId={selectedAgeRecord ? ageId(ageLayer, selectedAgeRecord) : ""} focusId={ageMapFocusId} onHover={(item) => setAgeHovered(item)} onSelect={(id) => { const record = ageRecordLookup.get(id); if (record) chooseAgeRecord(record); }} onClear={() => setSelectedAgeRecord(null)} />
          {ageHovered && <div className="age-map-tooltip" style={{ backgroundColor: ageColor }}><span>{ageHovered.eyebrow}</span><strong>{ageHovered.label}</strong><b>{ageCohort === "all" ? short(ageHovered.value) : `${ageHovered.share.toFixed(1)}%`}</b><small>{fmt.format(ageHovered.value)} {ageCohort === "all" ? "total registered" : ageViewLabel} voters</small></div>}
          <div className="age-map-legend"><span>{ageCohort === "all" ? "Total registered voters" : `${ageViewLabel} share`}</span>{[0, 1, 2, 3, 4].map((bin) => { const lower = ageMin + bin * ageBinSize; const upper = bin === 4 ? ageMax : ageMin + (bin + 1) * ageBinSize; return <div key={bin}><i style={{ backgroundColor: ageColor, opacity: .22 + bin * .195 }} /><small>{ageCohort === "all" ? `${legendShort(lower)}–${legendShort(upper)}` : `${lower.toFixed(1)}–${upper.toFixed(1)}%`}</small></div>; })}</div>
        </div>
      </div>
    </section>

    <section className="electorate-continue"><div><p className="dash-kicker">Explore the previous cycle</p><h2>The Philippine electorate<br /><em>in 2022.</em></h2></div><div><p>See registered voters alongside voter turnout, turnout rates, and precinct counts from the 2022 national and local elections.</p><a href="/dashboards/philippine-electorate-2022">Explore the 2022 electorate <span>→</span></a></div></section>

    <section className="source-section electorate-source" id="source"><p className="dash-kicker">About the data</p><h2>Registered-voter data</h2><div className="electorate-source-grid">
      <article><b>Primary source</b><a href="https://comelec.gov.ph/?r=2025NLE%2FStatistics" target="_blank" rel="noreferrer">COMELEC 2025 NLE Statistics ↗</a><p>{voterData.source}; Election and Barangay Affairs Department (EBAD).</p></article>
      <article><b>Coverage</b><p>{voterData.election}. Regional, provincial, and city/municipal records are included.</p></article>
      <article><b>Reference date</b><p>{voterData.asOf.replace("Based on Data from EBAD as of ", "")}.</p></article>
      <article><b>Age groups</b><p>Ages 18–30, 31–45, and 46–59 are summed from single-year records. The source combines voters aged 60 and older in one category.</p></article>
      <article><b>Geographic boundaries</b><p>Administrative boundaries are used only to locate and compare records. Map shapes do not change the COMELEC voter totals.</p></article>
      <article className="electorate-source-history"><b>Dashboard history</b><dl><div><dt>Created</dt><dd>14 August 2026</dd></div><div><dt>Last reviewed</dt><dd>24 August 2026</dd></div><div><dt>Last updated</dt><dd>24 August 2026</dd></div></dl><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log</button></article>
    </div></section>
    {showMaintenanceLog && <div className="electorate-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}><section className="electorate-change-log" role="dialog" aria-modal="true" aria-labelledby="electorate-log-title"><header><div><p className="dash-kicker">Dashboard history</p><h2 id="electorate-log-title">Maintenance Log</h2></div><button type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header><div className="electorate-log-entries"><article><time dateTime="2026-08-24">24 August 2026</time><h3>Data, map, search, layout, and documentation review</h3><p>Restored four independently administered cities omitted from the locality extract and reconciled locality totals to the national figure. Clarified NCR’s absence from province views, replaced generational claims with neutral age groups, improved responsive navigation and mobile statistics, and standardized map controls, typography, legends, and source notes. Added layer-aware search to both maps so users can find a region, province, city, or municipality and automatically select and focus the map on that area.</p></article><article><time dateTime="2026-08-18">18 August 2026</time><h3>Responsive chart and typography refinements</h3><p>Corrected age-chart overlap at narrower desktop widths and improved the legibility of chart labels, age ranges, and registered-voter annotations.</p></article><article><time dateTime="2026-08-14">14 August 2026</time><h3>Dashboard created</h3><p>Created the dashboard from COMELEC registered-voter data, including geographic, sex, and age-group views.</p></article></div></section></div>}
    <a className="back-to-top" href="#top" aria-label="Back to top" title="Back to top">↑</a>
    <footer className="dash-footer"><a href="/">← Back to Factbook</a><span>People &amp; Demography · 2025</span></footer>
  </main>;
}
