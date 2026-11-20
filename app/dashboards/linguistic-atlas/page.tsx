"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LinguisticMap, { type AtlasPoint, type AtlasPolygon } from "./LinguisticMap";
import atlasData from "../../../data/generated/kwf-languages-2024.json";
import provinceData from "../../../data/generated/philippines-provinces-simplified.json";

type Language = (typeof atlasData.languages)[number];
type ProvinceFeature = { type: "Feature"; geometry: unknown; properties: { province: string; region: string } };
const colors: Record<string, string> = { "Ligtas": "#1c7c54", "Di-ligtas": "#78a84b", "Tiyak na nanganganib": "#e7ad3c", "Matinding nanganganib": "#d95d55", "Malubhang nanganganib": "#a12d46", "Hindi pa tukóy": "#7b7688" };
const order = ["Ligtas", "Di-ligtas", "Tiyak na nanganganib", "Matinding nanganganib", "Malubhang nanganganib", "Hindi pa tukóy"];
const vitalityEnglish: Record<string, string> = { "Ligtas": "Safe", "Di-ligtas": "Unsafe", "Tiyak na nanganganib": "Definitely endangered", "Matinding nanganganib": "Severely endangered", "Malubhang nanganganib": "Critically endangered", "Hindi pa tukóy": "Not yet determined" };
const normalize = (value = "") => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const primary = atlasData.languages.filter((item) => item.entryType === "language") as Language[];
const provinces = provinceData.features as ProvinceFeature[];

export default function LinguisticAtlas() {
  const [query, setQuery] = useState("");
  const [vitality, setVitality] = useState("All");
  const [selectedNumber, setSelectedNumber] = useState<string>("1");
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  const maintenanceCloseRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMaintenanceLog(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  useEffect(() => { if (showMaintenanceLog) maintenanceCloseRef.current?.focus(); }, [showMaintenanceLog]);
  const selected = primary.find((item) => item.number === selectedNumber) ?? primary[0];
  const filtered = useMemo(() => primary.filter((item) => (vitality === "All" || item.vitality === vitality) && normalize(`${item.name} ${item.aliases.join(" ")} ${item.locations}`).includes(normalize(query))), [query, vitality]);
  const points: AtlasPoint[] = filtered.filter((item) => item.latitude != null && item.longitude != null).map((item) => ({ type: "Feature", geometry: { type: "Point", coordinates: [item.longitude!, item.latitude!] }, properties: { number: item.number, name: item.name, vitality: item.vitality, color: colors[item.vitality] ?? colors["Hindi pa tukóy"] } }));
  const selectedLocation = normalize(selected.locations);
  const polygonFeatures: AtlasPolygon[] = provinces.filter((feature) => {
    const provinceName = normalize(feature.properties.province);
    return provinceName.length > 3 && selectedLocation.includes(provinceName);
  }).map((feature) => ({ type: "Feature", geometry: feature.geometry, properties: { name: feature.properties.province } }));
  const variants = atlasData.languages.filter((item) => item.entryType === "variant" && item.parentNumber === selected.number);
  const counts = order.map((label) => ({ label, count: primary.filter((item) => item.vitality === label).length }));
  const fmt = new Intl.NumberFormat("en-PH");

  return <main className="atlas-page" id="top">
    <header className="atlas-nav"><a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a><nav aria-label="Dashboard sections"><a href="#overview">Overview</a><a href="#atlas">Explore the Atlas</a><a href="#source">About</a></nav></header>
    <header className="atlas-hero" id="overview">
      <div className="atlas-hero-copy"><p className="atlas-kicker">Demographics &amp; Social Development · 2024</p><h1>Languages at Risk in the Philippines</h1><p className="atlas-title-translation" lang="fil">Sigla ng mga Katutubong Wika ng Pilipinas</p><p className="atlas-deck">Where the country’s 135 indigenous languages are spoken—and which are at risk of disappearing.</p><div className="atlas-summary"><strong>135</strong><span>languages documented by KWF in 2024</span><strong>52</strong><span>classified as safe</span><strong>82</strong><span>at some level of endangerment</span></div></div>
      <aside className="atlas-vitality-overview"><p className="atlas-kicker">Vitality at a glance</p><h2>82 of 135 languages are at risk.</h2><div className="atlas-vitality-stack" role="img" aria-label="52 safe, 42 unsafe, 16 definitely endangered, 14 severely endangered, 10 critically endangered, and 1 not yet determined">{counts.map((item) => <i key={item.label} style={{ width: `${item.count / 135 * 100}%`, background: colors[item.label] }} />)}</div><div className="atlas-vitality-key">{counts.map((item) => <div key={item.label}><i style={{ background: colors[item.label] }} /><span><strong>{item.count}</strong>{vitalityEnglish[item.label]}<small lang="fil">{item.label}</small></span></div>)}</div></aside>
    </header>

    <section className="atlas-workspace" id="atlas">
      <aside className="atlas-sidebar">
        <label className="atlas-search"><span>Find a language or place</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Isináy or Ifugao" /></label>
        <div className="atlas-filter" aria-label="Filter by vitality"><button className={vitality === "All" ? "active" : ""} onClick={() => setVitality("All")}>All languages <b>135</b></button>{counts.map((item) => <button key={item.label} className={vitality === item.label ? "active" : ""} onClick={() => setVitality(item.label)}><i style={{ background: colors[item.label] }} /><span>{vitalityEnglish[item.label]}<small lang="fil">{item.label}</small></span><b>{item.count}</b></button>)}</div>
        <p className="atlas-results">{filtered.length} matching language{filtered.length === 1 ? "" : "s"}</p>
        <div className="atlas-language-list">{filtered.map((item) => <button key={item.number} className={selected.number === item.number ? "selected" : ""} onClick={() => setSelectedNumber(item.number)}><span>{item.number}</span><div><strong>{item.name}</strong><small>{vitalityEnglish[item.vitality]} · <span lang="fil">{item.vitality}</span></small></div></button>)}</div>
      </aside>

      <div className="atlas-map-panel">
        <LinguisticMap polygons={polygonFeatures} points={points} selectedNumber={selected.number} onSelect={setSelectedNumber} />
        <div className="atlas-map-note"><strong>Administrative approximation</strong><span>Highlighted provinces are matched from KWF’s written locations; points come from KWF’s earlier interactive atlas. They are not exact language boundaries.</span></div>
      </div>

      <aside className="atlas-detail">
        <div className="atlas-number">KWF no. {selected.number}</div>
        <h2>{selected.name}</h2>
        <p className="atlas-status"><i style={{ background: colors[selected.vitality] }} /><span><strong>{vitalityEnglish[selected.vitality]}</strong><small lang="fil">{selected.vitality}{selected.vitalityScore ? ` · Antas ${selected.vitalityScore}` : ""}</small></span></p>
        {selected.aliases.length > 0 && <div className="atlas-field"><h3>Alternative names</h3><p>{selected.aliases.join(" · ")}</p></div>}
        {variants.length > 0 && <div className="atlas-field"><h3>Documented varieties</h3><p>{variants.map((item) => item.name).join(" · ")}</p></div>}
        <div className="atlas-metrics"><div><span>Population</span><strong>{selected.population ? fmt.format(selected.population) : "—"}</strong><small>{selected.populationText.replace(/^\d[\d,]*\s*/, "")}</small></div><div><span>Households</span><strong>{selected.households ? fmt.format(selected.households) : "—"}</strong><small>{selected.householdsText.replace(/^\d[\d,]*\s*/, "")}</small></div></div>
        <div className="atlas-field"><h3>Locations documented by KWF</h3><p>{selected.locations || "No location text reported in this entry."}</p></div>
        {selected.detailImageUrl && <a className="atlas-source-image" href={selected.detailImageUrl} target="_blank" rel="noreferrer">Open KWF language sketch ↗</a>}
      </aside>
    </section>

    <section className="atlas-source" id="source"><div className="atlas-source-intro"><div><p className="atlas-kicker">About the data</p><h2>Sources, methods<br />&amp; history.</h2></div><p>The 2024 KWF list is the authority for language names, vitality, population, households, and documented locations. The older interactive atlas supplies supporting coordinates and language sketches.</p></div><div className="atlas-source-grid"><article><b>Primary source</b><a href={atlasData.metadata.sourceUrl} target="_blank" rel="noreferrer">KWF 2024 language list ↗</a><p><em>Listahan ng mga Katutubong Wika ng Pilipinas</em>, second-edition research validated through 2024.</p></article><article><b>Supporting source</b><a href={atlasData.metadata.interactiveUrl} target="_blank" rel="noreferrer">KWF interactive atlas ↗</a><p>Used for representative coordinates, older province associations, and language-sketch links.</p></article><article><b>Coverage</b><p>135 languages and 65 named variants. KWF reports 52 safe languages, 82 at some level of endangerment, and one language without a determined vitality classification.</p></article><article><b>Reference period</b><p>Language inventory and vitality: 2024. Most population and household figures: PSA 2020, with selected community and NCIP updates identified in each record.</p></article><article className="atlas-source-method"><b>How to read the map</b><p>Points are representative locations, not population centroids. Highlighted administrative areas are matched from KWF’s written place descriptions and do not claim exclusive or exact linguistic territory.</p></article><article className="atlas-source-history"><div><b>Dashboard history</b><dl><div><dt>Created</dt><dd>25 August 2026</dd></div><div><dt>Last reviewed</dt><dd>25 August 2026</dd></div><div><dt>Last updated</dt><dd>25 August 2026</dd></div></dl></div><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log</button></article></div></section>
    {showMaintenanceLog && <div className="atlas-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}><section className="atlas-maintenance-log" role="dialog" aria-modal="true" aria-labelledby="atlas-maintenance-title"><header><div><p className="atlas-kicker">Dashboard history</p><h2 id="atlas-maintenance-title">Maintenance Log</h2></div><button ref={maintenanceCloseRef} type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header><div className="atlas-log-entries"><article className="featured"><time dateTime="2026-08-25">25 August 2026</time><h3>Factbook structure and bilingual vitality terminology</h3><p>Aligned the dashboard with the Demographics &amp; Social Development teal theme, added standard navigation, source documentation, footer navigation, and bilingual English-Filipino vitality labels.</p></article><article><time dateTime="2026-08-25">25 August 2026</time><h3>KWF data extraction and reconciliation</h3><p>Extracted all 135 languages and 65 named variants from the KWF 2024 publication, reconciled vitality totals, and merged supporting coordinates, province links, and language sketches from the interactive atlas.</p></article><article><time dateTime="2026-08-25">25 August 2026</time><h3>Dashboard created</h3><p>Created the interactive Mapbox atlas with language search, vitality filtering, language profiles, documented locations, and explicit geographic-precision notes.</p></article></div></section></div>}
    <footer className="atlas-footer"><a href="/">← Back to Factbook</a><span>Demographics &amp; Social Development · 2024</span></footer><a className="atlas-top" href="#top" aria-label="Back to top" title="Back to top">↑</a>
  </main>;
}
