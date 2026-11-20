"use client";

import { useMemo, useState } from "react";
import provincesGeo from "../../../data/generated/philippines-provinces-simplified.json";
import verifiedGeography from "../../../data/generated/philippine-language-geography-verified.json";
import MapboxChoropleth, { type MapFeature, type MapHover } from "../philippine-electorate/MapboxChoropleth";
import "./languages.css";

type Level = "region" | "province";
type Feature = { properties: { province: string; region: string }; geometry: { type: string; coordinates: unknown } };
type VerifiedRecord = { level: Level; id: string; name: string; language: string; households: number | null; share: number; source: string; table: string };

const languageColors: Record<string, string> = {
  Tagalog: "#087f78", Bisaya: "#13a89e", Hiligaynon: "#5dbb9b", Ilocano: "#286f8d",
  Cebuano: "#20b7b0", Bikol: "#78b96d", Waray: "#e3a747", Kapampangan: "#9878ad",
  Maguindanao: "#d86e67", Pangasinan: "#db8b5a", Maranao: "#b86575", Tausug: "#b98b43",
  Kankanaey: "#727f90", Kalinga: "#8b91a3", Ifugao: "#9d8e78", Ivatan: "#688d93",
  Aklanon: "#65a57b", "Kinaray-a": "#80a55b", Boholano: "#42a6a0", Surigaonon: "#547e88",
  Masbateño: "#8aae63", Yakan: "#b47a63", "Sama/Tausug": "#b98b43", Tuwali: "#9d8e78",
  Romblomanon: "#8d6f9e", "Awaiting verification": "#c5cecb",
};

const national = [
  ["Tagalog", 10522507, 39.9], ["Bisaya/Binisaya", 4214122, 16.0], ["Hiligaynon/Ilonggo", 1933512, 7.3],
  ["Ilocano", 1863409, 7.1], ["Cebuano", 1716080, 6.5], ["Bikol/Bicol", 1033457, 3.9],
  ["Waray", 698745, 2.6], ["Kapampangan", 639687, 2.4], ["Maguindanao", 365032, 1.4],
  ["Pangasinan/Panggalato", 334759, 1.3],
] as const;

const distribution = [
  ["Tagalog", 39.9, "#18b5aa"], ["Bisaya/Binisaya", 16.0, "#4bc9b7"], ["Hiligaynon/Ilonggo", 7.3, "#8dd8bd"],
  ["Ilocano", 7.1, "#4d91ad"], ["Cebuano", 6.5, "#47b9c0"], ["Bikol/Bicol", 3.9, "#9cc77d"],
  ["Waray", 2.6, "#e9b34d"], ["Kapampangan", 2.4, "#ad8ec0"], ["Maguindanao", 1.4, "#e07d72"],
  ["Pangasinan/Panggalato", 1.3, "#e69a68"], ["Other languages", 11.2, "#748d88"], ["Not reported", .4, "#d7dfdc"],
] as const;
let chartCursor = 0;
const distributionGradient = `conic-gradient(${distribution.map(([, share, color]) => { const start = chartCursor; chartCursor += share; return `${color} ${start}% ${chartCursor}%`; }).join(",")})`;

const regionNames: Record<string, string> = { NCR: "National Capital Region", CAR: "Cordillera Administrative Region", I: "Ilocos Region", II: "Cagayan Valley", III: "Central Luzon", CALABARZON: "CALABARZON", MIMAROPA: "MIMAROPA", V: "Bicol Region", VI: "Western Visayas", NIR: "Negros Island Region", VII: "Central Visayas", VIII: "Eastern Visayas", IX: "Zamboanga Peninsula", X: "Northern Mindanao", XI: "Davao Region", XII: "SOCCSKSARGEN", XIII: "Caraga", BARMM: "BARMM" };

const referenceRegionDominant: Record<string, string> = {
  NCR: "Tagalog", CAR: "Ilocano", I: "Ilocano", II: "Ilocano", III: "Tagalog",
  CALABARZON: "Tagalog", MIMAROPA: "Tagalog", V: "Bikol", VI: "Hiligaynon", NIR: "Hiligaynon",
  VII: "Cebuano", VIII: "Waray", IX: "Bisaya", X: "Bisaya", XI: "Bisaya", XII: "Hiligaynon",
  XIII: "Bisaya", BARMM: "Maguindanao",
};
const referenceProvinceExceptions: Record<string, string> = {
  PANGASINAN: "Pangasinan", PAMPANGA: "Kapampangan", "MOUNTAIN PROVINCE": "Kankanaey", KALINGA: "Kalinga",
  IFUGAO: "Ifugao", BATANES: "Ivatan", AKLAN: "Aklanon", ANTIQUE: "Kinaray-a", BOHOL: "Boholano",
  "NEGROS ORIENTAL": "Cebuano", SIQUIJOR: "Cebuano", MASBATE: "Masbateño", "SOUTHERN LEYTE": "Cebuano",
  "LANAO DEL SUR": "Maranao", SULU: "Tausug", "TAWI-TAWI": "Sama/Tausug", BASILAN: "Yakan",
  "DINAGAT ISLANDS": "Surigaonon", "SURIGAO DEL NORTE": "Surigaonon", "SURIGAO DEL SUR": "Surigaonon",
};

function categoryForNational(name: string) { return ({ "Bisaya/Binisaya": "Bisaya", "Hiligaynon/Ilonggo": "Hiligaynon", "Bikol/Bicol": "Bikol", "Pangasinan/Panggalato": "Pangasinan" } as Record<string, string>)[name] ?? name; }
const number = new Intl.NumberFormat("en-PH");
const verifiedRecords = verifiedGeography.records as VerifiedRecord[];

export default function PhilippineLanguages() {
  const [level, setLevel] = useState<Level>("region");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hovered, setHovered] = useState<MapHover | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [highlightedLanguage, setHighlightedLanguage] = useState<string | null>(null);
  const features = (provincesGeo.features as Feature[]);
  const levelRecords = useMemo(() => verifiedRecords.filter(record => record.level === level), [level]);
  const verifiedById = useMemo(() => new Map(levelRecords.map(record => [record.id, record])), [levelRecords]);
  const classificationById = useMemo(() => {
    const classifications = new Map<string, { language: string; status: "verified" | "reference"; record: VerifiedRecord | null }>();
    if (level === "region") {
      Object.keys(regionNames).forEach(id => {
        const record = verifiedById.get(id) ?? null;
        classifications.set(id, { language: record?.language ?? referenceRegionDominant[id], status: record ? "verified" : "reference", record });
      });
    } else {
      features.forEach(feature => {
        const id = feature.properties.province;
        const record = verifiedById.get(id) ?? null;
        classifications.set(id, { language: record?.language ?? referenceProvinceExceptions[id] ?? referenceRegionDominant[feature.properties.region], status: record ? "verified" : "reference", record });
      });
    }
    return classifications;
  }, [level, features, verifiedById]);
  const used = useMemo(() => Array.from(new Set(Array.from(classificationById.values()).map(item => item.language))).filter(Boolean), [classificationById]);
  const mapFeatures = useMemo<MapFeature[]>(() => {
    if (level === "province") return features.map((feature) => {
      const classification = classificationById.get(feature.properties.province)!;
      return { type: "Feature", id: feature.properties.province, geometry: feature.geometry, properties: { recordId: feature.properties.province, eyebrow: classification.status === "verified" ? "PSA-verified province" : "Reference-map province", label: titleCase(feature.properties.province), value: classification.record?.households ?? 0, share: classification.record?.share ?? 0, fill: languageColors[classification.language] ?? "#748d88", opacity: classification.status === "verified" ? .9 : .78 } };
    });
    const grouped = new Map<string, Feature[]>();
    features.forEach(feature => grouped.set(feature.properties.region, [...(grouped.get(feature.properties.region) ?? []), feature]));
    return Array.from(grouped.entries()).map(([region, items]) => {
      const classification = classificationById.get(region)!;
      const polygons = items.flatMap(item => item.geometry.type === "Polygon" ? [item.geometry.coordinates] : item.geometry.coordinates as unknown[]);
      return { type: "Feature", id: region, geometry: { type: "MultiPolygon", coordinates: polygons }, properties: { recordId: region, eyebrow: classification.status === "verified" ? "PSA-verified region" : "Reference-map region", label: regionNames[region] ?? region, value: classification.record?.households ?? 0, share: classification.record?.share ?? 0, fill: languageColors[classification.language] ?? "#748d88", opacity: classification.status === "verified" ? .9 : .78 } };
    });
  }, [level, features, classificationById]);
  const activeFeature = mapFeatures.find(feature => feature.properties.recordId === activeId) ?? null;
  const displayFeature = hovered ?? (activeFeature ? { eyebrow: activeFeature.properties.eyebrow, label: activeFeature.properties.label, value: 0, share: 0 } : null);
  const activeRecord = activeId ? verifiedById.get(activeId) ?? null : null;
  const activeClassification = activeId ? classificationById.get(activeId) ?? null : null;
  const highlightedIds = highlightedLanguage ? mapFeatures.filter(feature => feature.properties.fill === languageColors[highlightedLanguage]).map(feature => feature.properties.recordId) : [];
  const selectedCategory = selectedLanguage ? categoryForNational(selectedLanguage) : null;
  const selectedAreas = selectedCategory ? {
    regions: Object.keys(regionNames).filter(id => (verifiedRecords.find(record => record.level === "region" && record.id === id)?.language ?? referenceRegionDominant[id]) === selectedCategory).map(id => regionNames[id]),
    provinces: features.filter(feature => (verifiedRecords.find(record => record.level === "province" && record.id === feature.properties.province)?.language ?? referenceProvinceExceptions[feature.properties.province] ?? referenceRegionDominant[feature.properties.region]) === selectedCategory).map(feature => titleCase(feature.properties.province)).sort(),
  } : null;
  return <main className="language-page" id="top">
    <header className="language-nav">
      <a className="language-brand" href="/"><span>DATA</span><strong>Factbook</strong></a>
      <nav aria-label="Dashboard navigation"><a href="#atlas">Leading Language Map</a><a href="#ranking">Top 10 Languages</a><a href="#sources">Sources</a></nav>
    </header>

    <section className="language-hero">
      <div><p className="language-kicker">Demographics &amp; Social Development · 2020 Census</p><h1>Top languages<br />spoken <em>at home</em><br />in the Philippines.</h1><p className="language-deck">A geographic view of the Philippines’ leading household languages—combining national census results with verified and supplementary geographic references.</p><dl className="language-release"><div><dt>Census reference date</dt><dd>01 May 2020</dd></div><div><dt>PSA release date</dt><dd>07 March 2023</dd></div></dl></div>
      <aside><span>Leading nationwide</span><strong>Tagalog</strong><b>39.9%</b><small>of 26.39 million households</small></aside>
    </section>

    <section className="language-atlas" id="atlas">
      <div className="language-section-head"><div><p className="language-kicker">Geographic atlas</p><h2>Where languages lead</h2></div><p>The map combines verified PSA geographic results with major-language reference maps. PSA results take precedence wherever available.</p></div>
      <div className="language-level" role="group" aria-label="Geographic level"><button className={level === "region" ? "active" : ""} onClick={() => { setLevel("region"); setActiveId(null); setHighlightedLanguage(null); }}>Region</button><button className={level === "province" ? "active" : ""} onClick={() => { setLevel("province"); setActiveId(null); setHighlightedLanguage(null); }}>Province</button></div>
      <div className="atlas-grid">
        <div className="map-card">
          <div className="map-caption"><span>{displayFeature?.eyebrow ?? (level === "region" ? "Combined regional view" : "Combined provincial view")}</span><b>{displayFeature?.label ?? "Select an area"}</b><small>{hovered ? "Click to view its classification and source status" : activeRecord ? `${activeRecord.language} · ${activeRecord.share.toFixed(1)}%${activeRecord.households ? ` · ${number.format(activeRecord.households)} households` : ""}` : activeClassification ? `${activeClassification.language} · broad reference classification, not a verified 2020 census rank` : "Hover, click, or tap the map to explore"}</small>{!hovered && activeRecord && <a href={activeRecord.source} target="_blank" rel="noreferrer">PSA {activeRecord.table} ↗</a>}</div>
          <MapboxChoropleth ariaLabel={`Interactive Philippines ${level} language map`} features={mapFeatures} selectedId={activeId} highlightedIds={highlightedIds} onHover={setHovered} onSelect={(id) => { setActiveId(id); setHighlightedLanguage(null); }} onClear={() => { setActiveId(null); setHighlightedLanguage(null); }} />
        </div>
        <aside className="legend-card"><p className="language-kicker">Map key</p><h3>Leading or major language</h3><div className="legend-list">{used.sort().map(name => <button key={name} className={highlightedLanguage === name ? "active" : ""} aria-pressed={highlightedLanguage === name} onClick={() => { setActiveId(null); setHighlightedLanguage(highlightedLanguage === name ? null : name); }}><i style={{ background: languageColors[name] }} /><span>{name}</span></button>)}</div><p className="legend-note">Select a language to highlight its areas. An area card identifies whether the result is PSA-verified or reference-based.</p></aside>
      </div>
      <p className="atlas-sources"><strong>Map note.</strong> Classifications combine 2020 PSA geographic tables with the <a href="https://en.wikipedia.org/wiki/Languages_of_the_Philippines#/media/File:Major_Philippine_languages.png" target="_blank" rel="noreferrer">major Philippine languages map ↗</a> and the <a href="https://www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2F1b85hv651ht91.jpg" target="_blank" rel="noreferrer">Australian Academy of the Humanities reference map ↗</a> supplied for this dashboard. PSA-verified results override reference classifications. Reference-based areas indicate broad language geography and should not be interpreted as exact 2020 census rankings or boundaries.</p>
    </section>

    <section className="national-ranking" id="ranking">
      <div className="language-section-head"><div><p className="language-kicker">National picture</p><h2>Ten leading home languages</h2></div><p>Households reporting the language they generally used at home. This is not a count of everyone able to speak each language.</p></div>
      <div className="distribution-grid">
        <figure className="distribution-chart">
          <div className="donut" style={{ background: distributionGradient }} role="img" aria-label="Distribution of languages generally spoken at home: Tagalog 39.9 percent, Bisaya or Binisaya 16 percent, other languages 11.2 percent, eight other named leading languages 32.5 percent, and not reported 0.4 percent"><div><strong>26.39M</strong><span>households</span><small>Philippines, 2020</small></div></div>
          <figcaption><p className="language-kicker">Share of households</p><h3>One country,<br />many home languages.</h3><div>{distribution.map(([name, share, color]) => <span key={name}><i style={{ background: color }} /><b>{name}</b><small>{share.toFixed(1)}%</small></span>)}</div></figcaption>
        </figure>
        <div className="ranking-surface"><div className="ranking-grid">{national.map(([name, households, share], index) => <article className={selectedLanguage === name ? "expanded" : ""} key={name}>
          <button className="ranking-row" type="button" aria-expanded={selectedLanguage === name} onClick={() => setSelectedLanguage(selectedLanguage === name ? null : name)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{name}</strong><i><b style={{ width: `${share / 39.9 * 100}%` }} /></i></div><div><b>{share.toFixed(1)}%</b><small>{number.format(households)} households</small><em aria-hidden="true">{selectedLanguage === name ? "−" : "+"}</em></div></button>
          {selectedLanguage === name && selectedAreas && <div className="language-area-panel">
            <div><header><span>Region level</span><b>{selectedAreas.regions.length}</b></header>{selectedAreas.regions.length ? <ul>{selectedAreas.regions.map(area => <li key={area}>{area}</li>)}</ul> : <p>No region-wide leading classification in this reference view.</p>}</div>
            <div><header><span>Province level</span><b>{selectedAreas.provinces.length}</b></header>{selectedAreas.provinces.length ? <ul>{selectedAreas.provinces.map(area => <li key={area}>{area}</li>)}</ul> : <p>No province-wide leading classification in this reference view.</p>}</div>
            <small>These lists combine PSA-verified results and broad reference-map classifications. They do not include every area where the language is spoken.</small>
          </div>}
        </article>)}</div></div>
        <div className="language-callout"><strong>Why are Bisaya and Cebuano listed separately?</strong><p>PSA counted “Bisaya/Binisaya” and “Cebuano” as separate household responses. If combined, they would account for 22.5% of households—larger than either category alone, but still below Tagalog’s 39.9%. This combined figure is illustrative and is not an official PSA category.</p></div>
      </div>
    </section>

    <section className="language-sources" id="sources">
      <p className="language-kicker">About the data</p><h2>Sources and Methodology</h2>
      <div className="source-grid">
        <article><b>Primary source</b><a href="https://psa.gov.ph/content/tagalog-most-widely-spoken-language-home-2020-census-population-and-housing" target="_blank" rel="noreferrer">PSA 2020 Census language tables ↗</a><p>Philippine Statistics Authority, 2020 Census of Population and Housing. Released 07 March 2023.</p></article>
        <article><b>Measure</b><p>The census asked: “What is the language/dialect generally spoken at home by the members of this household?” Results describe households, not individual fluency or second-language use.</p></article>
        <article><b>Geographic treatment</b><p>The map combines PSA tables with two broad major-language reference maps. An identified PSA result always overrides a reference classification.</p><a href="https://rssocar.psa.gov.ph/content/languagedialect-generally-spoken-home-cordillera-2020-census-population-and-housing" target="_blank" rel="noreferrer">PSA CAR tables ↗</a><br /><a href="https://rssomimaropa.psa.gov.ph/content/languages-dialects-spoken-home-mimaropa-region-2020-census-population-and-housing" target="_blank" rel="noreferrer">PSA MIMAROPA tables ↗</a></article>
        <article><b>Coverage and limitations</b><p>Reference-based areas show broad language geography, not exact 2020 census rankings or linguistic boundaries. National totals exclude households enumerated as homeless. Select an area to see its evidence status.</p></article>
        <article className="language-history"><b>Dashboard history</b><dl><div><dt>Created</dt><dd>25 August 2026</dd></div><div><dt>Last reviewed</dt><dd>25 August 2026</dd></div><div><dt>Last updated</dt><dd>25 August 2026</dd></div></dl><button type="button" onClick={() => setShowActivity(true)}>View dashboard activity</button></article>
      </div>
    </section>
    {showActivity && <div className="activity-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowActivity(false); }}><section className="activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-title">
      <header><div><p className="language-kicker">Dashboard history</p><h2 id="activity-title">Dashboard Activity</h2></div><button type="button" onClick={() => setShowActivity(false)} aria-label="Close dashboard activity">×</button></header>
      <div className="activity-featured"><time dateTime="2026-08-25">25 August 2026</time><h3>Interactive census-language dashboard developed</h3><p>Created the regional and provincial language-at-home dashboard and documented its geographic and interpretive limitations.</p></div>
      <ol>
        <li><span>Geographic coverage updated</span><h3>Combined, source-labeled language map</h3><p>Restored nationwide coverage from the supplied major-language maps. Verified PSA classifications override reference-based results, and each selected area identifies its evidence status.</p></li>
        <li><span>National comparison added</span><h3>Household-language distribution</h3><p>Added the complete 100% donut chart and ranked bars using PSA’s ten leading categories, other languages, and unreported households.</p></li>
        <li><span>Interface standardized</span><h3>Factbook navigation and documentation</h3><p>Applied the Demographics &amp; Social Development teal theme, standard navigation, source documentation, dashboard dates, and activity history.</p></li>
      </ol>
      <footer><time dateTime="2026-08-25">25 August 2026</time><p>Dashboard created.</p></footer>
    </section></div>}
    <footer className="language-footer"><a href="/">← Back to Factbook</a><span>Demographics &amp; Social Development · 2020 Census</span><a href="#top">Back to top ↑</a></footer>
  </main>;
}

function titleCase(value: string) { return value.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace("(not A Province)", "(city)"); }
