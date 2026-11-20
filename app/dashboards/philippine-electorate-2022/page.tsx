"use client";

import { useEffect, useState } from "react";
import MapboxChoropleth, { type MapFeature } from "../philippine-electorate/MapboxChoropleth";
import data from "../../../data/generated/voters-2022-geography.json";
import provinceBoundaries from "../../../data/generated/philippines-provinces-simplified.json";
import municipalBoundaries from "../../../data/generated/philippines-municipalities-simplified.json";

type Layer = "region" | "province" | "municipality";
type Measure = "registered" | "voted";
type VoterRecord = { name: string; region: string; province: string; registered: number; voted: number; turnout: number; establishedPrecincts: number; clusteredPrecincts: number };
type Boundary = { properties: { province?: string; region?: string; name?: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };

const fmt = new Intl.NumberFormat("en-PH");
const compact = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)}M` : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K` : fmt.format(value);
const key = (value = "") => value.toUpperCase().replace(/Ñ/g, "N").replace(/ - .+$/, "").replace(/^(CITY|MUNICIPALITY) OF /, "").replace(/^CITY /, "").replace(/ CITY$/, "").replace(/[^A-Z0-9]/g, "");
const localityAliases: Record<string, string> = { BUMBARAN: "AMAIMANABILANG", TAGOLOANII: "TAGOLOAN", SHARIFFSAYDONAMUSTAPHA: "SHARIFFSAYDONAMUSTHAPA", CITYOFMEYCAUAYAN: "MECAUAYAN", MEYCAUAYAN: "MECAUAYAN", GENMARIANOALVAREZ: "GENERALMARIANOALVAREZ", ROSELLERLIM: "ROSELLERTLIM", GETAFE: "JETAFE", PINAMUNGAHAN: "PINAMUNGAJAN" };
const provinceAliases: Record<string, string> = { COTABATONORTHCOTABATO: "COTABATO", MAGUINDANAODELNORTE: "MAGUINDANAO", MAGUINDANAODELSUR: "MAGUINDANAO", SAMARWESTERNSAMAR: "SAMAR", COMPOSTELAVALLEY: "DAVAODEORO", ISABELANOTAPROVINCE: "BASILAN" };
const regionAliases: Record<string, string> = { NATIONALCAPITALREGIONNCR: "NCR" };
const regionNames: Record<string, string> = { NCR: "NCR", CAR: "CORDILLERA ADM. REGION", I: "REGION I", II: "REGION II", III: "REGION III", CALABARZON: "REGION IV-A", MIMAROPA: "REGION IV-B", V: "REGION V", VI: "REGION VI", VII: "REGION VII", VIII: "REGION VIII", IX: "REGION IX", X: "REGION X", XI: "REGION XI", XII: "REGION XII", XIII: "CARAGA", BARMM: "B A R M M" };
const colors = ["#dce9e5", "#b8d3cd", "#83b5ae", "#438f8b", "#12666b"];

const regions = data.regions as VoterRecord[];
const provinces = data.provinces as VoterRecord[];
const localities = data.localities as VoterRecord[];
const regionLookup = new Map(regions.map((item) => [key(item.name), item]));
const provinceLookup = new Map(provinces.map((item) => [key(item.name), item]));
const localityLookup = new Map<string, VoterRecord[]>();
for (const item of localities) localityLookup.set(key(item.name), [...(localityLookup.get(key(item.name)) ?? []), item]);

const localityFor = (name = "", province = "", region = "") => {
  const nameKey = localityAliases[key(name)] ?? key(name);
  const matches = localityLookup.get(nameKey) ?? [];
  const provinceKey = /^CITY OF ISABELA$/i.test(name) ? "BASILAN" : provinceAliases[key(province)] ?? key(province);
  const rawRegionKey = key(regionNames[region] ?? region);
  const regionKey = regionAliases[rawRegionKey] ?? rawRegionKey;
  return matches.find((item) => key(item.province) === provinceKey) ?? matches.find((item) => key(item.region) === regionKey) ?? matches[0];
};

export default function PhilippineElectorate2022() {
  const national = data.national as VoterRecord;
  const [layer, setLayer] = useState<Layer>("region");
  const [measure, setMeasure] = useState<Measure>("registered");
  const [selected, setSelected] = useState<VoterRecord>(national);
  const [selectedId, setSelectedId] = useState("");
  const [hovered, setHovered] = useState<{ label: string; value: number; turnout: number } | null>(null);
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMaintenanceLog(false); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, []);
  const records = layer === "region" ? regions : layer === "province" ? provinces : localities;
  const boundaries = (layer === "municipality" ? municipalBoundaries.features : provinceBoundaries.features) as Boundary[];
  const value = (item: VoterRecord) => item[measure];
  const ranked = [...records].sort((a, b) => value(b) - value(a)).slice(0, layer === "municipality" ? 50 : undefined);
  const max = Math.max(...ranked.map(value), 1);

  const boundaryRecord = (feature: Boundary) => {
    if (layer === "province") return provinceLookup.get(provinceAliases[key(feature.properties.province)] ?? key(feature.properties.province));
    if (layer === "municipality") return localityFor(feature.properties.name, feature.properties.province, feature.properties.region);
    if (feature.properties.region === "NIR") {
      return key(feature.properties.province).includes("OCCIDENTAL") ? regionLookup.get(key("REGION VI")) : regionLookup.get(key("REGION VII"));
    }
    return regionLookup.get(key(regionNames[feature.properties.region ?? ""]));
  };
  const mapValues = boundaries.map(boundaryRecord).filter(Boolean).map((item) => value(item!));
  const min = 0;
  const high = Math.max(...mapValues, 1);
  const step = Math.max((high - min) / 5, .01);
  const legendBins = colors.map((color, index) => ({
    color,
    from: min + step * index,
    to: index === colors.length - 1 ? high : min + step * (index + 1),
  }));
  const recordById = new Map<string, VoterRecord>();
  const mapFeatures: MapFeature[] = boundaries.map((feature, index) => {
    const item = boundaryRecord(feature);
    const id = item ? `${layer}:${key(item.region)}:${key(item.province)}:${key(item.name)}` : `missing:${index}`;
    if (item) recordById.set(id, item);
    const itemValue = item ? value(item) : 0;
    const bin = item ? Math.min(4, Math.max(0, Math.floor((itemValue - min) / step))) : 0;
    return { type: "Feature", id, properties: { recordId: id, share: item?.turnout ?? 0, label: item?.name ?? feature.properties.name ?? "No record", eyebrow: item?.province || item?.region || layer, value: itemValue, fill: item ? colors[bin] : "#d7dcda", opacity: item ? 1 : .35 }, geometry: feature.geometry } as MapFeature;
  });
  const choose = (item: VoterRecord) => {
    const id = `${layer}:${key(item.region)}:${key(item.province)}:${key(item.name)}`;
    setSelected(item); setSelectedId(id);
  };

  return <main className="electorate electorate-2022">
    <header className="dash-nav"><a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a><nav><a href="#map">Electoral map</a><a href="#participation">Participation</a><a href="#source">About</a></nav></header>
    <section className="electorate-hero electorate-2022-hero">
      <div><p className="dash-kicker">People &amp; Demography · National and Local Elections</p><div className="electorate-2022-edition"><strong>2022</strong><span>Election edition</span></div><h1>The Philippine<br /><em>electorate.</em></h1><p className="dash-deck">Explore where 65.75 million Filipinos were registered—and how many cast a ballot—in the May 2022 national and local elections.</p></div>
      <div className="hero-stat"><span>Registered voters</span><strong>{compact(national.registered)}</strong><small>{fmt.format(national.registered)} · local electorate</small></div>
    </section>

    <section className="electorate-2022-map" id="map">
      <header><div><p className="dash-kicker">Electoral geography</p><h2>Registration and participation<br />across the Philippines.</h2></div><p>Compare the size of the registered electorate with the number who actually voted. Turnout rates are shown with participation counts, not as a separate population map.</p></header>
      <div className="electorate-2022-controls"><div className="layer-tabs">{(["region", "province", "municipality"] as Layer[]).map((item) => <button key={item} className={layer === item ? "active" : ""} onClick={() => { setLayer(item); setSelected(national); setSelectedId(""); }}>{item === "municipality" ? "City / municipality" : item}</button>)}</div><div className="measure-tabs">{(["registered", "voted"] as Measure[]).map((item) => <button key={item} className={measure === item ? "active" : ""} onClick={() => setMeasure(item)}>{item === "voted" ? "Voter turnout" : "Registered voters"}</button>)}</div></div>
      <div className="electorate-2022-grid">
        <aside className="electorate-2022-profile"><p className="dash-kicker">Selected area</p><h3>{selected.name}</h3><strong>{compact(value(selected))}</strong><span>{measure === "registered" ? "registered voters" : "voter turnout"}</span>{measure === "voted" && <p className="electorate-2022-rate"><b>{selected.turnout.toFixed(2)}%</b><span>voter turnout rate</span></p>}<dl><div><dt>Registered voters</dt><dd>{fmt.format(selected.registered)}</dd></div><div><dt>Voter turnout</dt><dd>{fmt.format(selected.voted)}</dd></div><div><dt>Voter turnout rate</dt><dd>{selected.turnout.toFixed(2)}%</dd></div><div><dt>Clustered precincts</dt><dd>{fmt.format(selected.clusteredPrecincts)}</dd></div></dl></aside>
        <aside className="electorate-2022-ranking"><div><p className="dash-kicker">Geographic comparison</p><h3>{layer === "municipality" ? "Top 50 cities & municipalities" : `${layer[0].toUpperCase()}${layer.slice(1)} ranking`}</h3>{measure === "voted" && <><p className="electorate-2022-bar-key"><span><i />Voted</span><span><i />Did not vote</span></p><small className="electorate-2022-bar-note">Full bar = registered voters</small></>}</div><div>{ranked.map((item, index) => <button key={`${item.region}:${item.province}:${item.name}`} onClick={() => choose(item)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><b>{compact(value(item))}{measure === "voted" && <small>{item.turnout.toFixed(1)}% turnout rate</small>}</b>{measure === "voted" ? <i className="participation-stack"><em style={{ width: `${item.turnout}%` }} /></i> : <i style={{ width: `${value(item) / max * 100}%` }} />}</button>)}</div></aside>
        <div className="electorate-2022-mapbox"><MapboxChoropleth ariaLabel={`2022 Philippine electorate by ${layer}`} features={mapFeatures} selectedId={selectedId} focusId={null} onHover={(item) => { const record = item ? recordById.get(item.recordId) : undefined; setHovered(record ? { label: record.name, value: value(record), turnout: record.turnout } : null); }} onSelect={(id) => { const item = recordById.get(id); if (item) choose(item); }} onClear={() => { setSelected(national); setSelectedId(""); }} /><div className="electorate-2022-map-legend" aria-label={`${measure === "registered" ? "Registered voters" : "Voter turnout count"} color scale`}><b>{measure === "registered" ? "Registered voters" : "Voter turnout · voters"}</b>{legendBins.map((bin, index) => <span key={bin.color}><i style={{ background: bin.color }} /><small>{compact(bin.from)}{index === legendBins.length - 1 ? "–" : "–<"}{compact(bin.to)}</small></span>)}</div>{hovered && <div className="electorate-2022-tooltip"><b>{hovered.label}</b><strong>{fmt.format(hovered.value)}</strong><small>{measure === "registered" ? "registered voters" : `voter turnout · ${hovered.turnout.toFixed(2)}% turnout rate`}</small></div>}</div>
      </div>
    </section>

    <section className="electorate-2022-participation" id="participation"><div><p className="dash-kicker">National participation</p><h2>More than five in six<br />registered voters participated.</h2><p>Of the local electorate, {fmt.format(national.voted)} people cast a ballot. The resulting turnout was {national.turnout.toFixed(2)}%.</p></div><div className="turnout-ring" style={{ background: `conic-gradient(#e3a94d 0 ${national.turnout}%, rgba(255,255,255,.13) ${national.turnout}% 100%)` }}><span><strong>{national.turnout.toFixed(1)}%</strong><small>turnout</small></span></div><dl><div><dt>Did not vote</dt><dd>{fmt.format(national.registered - national.voted)}</dd></div><div><dt>Established precincts</dt><dd>{fmt.format(national.establishedPrecincts)}</dd></div><div><dt>Clustered precincts</dt><dd>{fmt.format(national.clusteredPrecincts)}</dd></div></dl></section>

    <section className="electorate-continue"><div><p className="dash-kicker">Continue exploring</p><h2>The Philippine electorate<br /><em>in 2025.</em></h2></div><div><p>Move to the next election cycle for a demographic view of registered voters by age, sex, and geography.</p><a href="/dashboards/philippine-electorate">Explore the 2025 electorate <span>→</span></a></div></section>

    <section className="source-section electorate-source" id="source"><p className="dash-kicker">About the data</p><h2>Sources</h2><div className="electorate-source-grid"><article><b>Primary source</b><a href={data.sourceUrl} target="_blank" rel="noreferrer">COMELEC 2022 NLE Statistics ↗</a><p>{data.source}.</p></article><article><b>Coverage</b><p>17 regions, 81 provinces, and 1,634 cities and municipalities in COMELEC’s domestic locality table. Overseas-voting statistics are published separately by COMELEC.</p></article><article><b>Reference</b><p>{data.election}. The table was updated on {data.updated}.</p></article><article><b>Historical boundaries</b><p>2022 regional assignments are preserved in the data. Current map geometry is used only to locate each record; Negros Island’s provinces are colored under their 2022 regions.</p></article><article><b>What is not shown</b><p>The published locality table does not provide the single-year age-by-sex detail available for 2025, so this dashboard does not infer it.</p></article><article className="electorate-source-history"><b>Dashboard history</b><dl><div><dt>Created</dt><dd>28 August 2026</dd></div><div><dt>Last reviewed</dt><dd>28 August 2026</dd></div><div><dt>Last updated</dt><dd>28 August 2026</dd></div></dl><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log</button></article></div></section>
    {showMaintenanceLog && <div className="electorate-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}><section className="electorate-change-log" role="dialog" aria-modal="true" aria-labelledby="electorate-2022-log-title"><header><div><p className="dash-kicker">Dashboard history</p><h2 id="electorate-2022-log-title">Maintenance Log</h2></div><button type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header><div className="electorate-log-entries"><article><time dateTime="2026-08-28">28 August 2026</time><h3>Data and usability QA</h3><p>Reconciled every regional and locality total with COMELEC’s national figures, independently recalculated turnout rates, checked all map matches and historical-name crosswalks, and tested the dashboard across desktop and mobile layouts. Added a count-scale legend and clearer chart denominators.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>Participation display and terminology review</h3><p>Removed the standalone turnout-rate choropleth, renamed participation measures for clarity, added stacked voted-versus-did-not-vote bars, increased map-panel typography, and standardized source and maintenance documentation.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>Dashboard created</h3><p>Created the 2022 electorate dashboard from COMELEC’s final city and municipality table, including registered voters, voter turnout, turnout rates, precincts, and historical regional assignments.</p></article></div></section></div>}
    <footer className="dash-footer"><a href="/">← Back to Factbook</a><span>People &amp; Demography · 2022</span></footer>
  </main>;
}
