"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MapboxChoropleth, { type MapFeature, type MapHover } from "../philippine-electorate/MapboxChoropleth";
import electionData from "../../../data/generated/comelec-senate-2022.json";
import provinceBoundaries from "../../../data/generated/philippines-provinces-simplified.json";
import municipalityBoundaries from "../../../data/generated/philippines-municipalities-simplified.json";
import geographyCrosswalk from "../../../data/generated/comelec-senate-2022-geography.json";
import voterGeography from "../../../data/generated/voters-2022-geography.json";

type Candidate = { ballotNumber: number; name: string; party: string; votes: number; rank: number; comelecPercentage: number };
type ElectionRecord = { code: string; level: string; name: string; region?: string | null; province?: string | null; candidates: Candidate[]; cocReceivedPercentage: number | null; registeredVoters?: number | null };
type CandidateDirectoryItem = Pick<Candidate, "ballotNumber" | "name" | "party">;
type CompactRecord = { code: string; level: string; name: string; region?: string | null; province?: string | null; cocReceivedPercentage: number | null; results: number[][] };
type Layer = "region" | "province" | "municipality";
type Boundary = { properties: { name?: string; province?: string; region?: string; psgc?: string }; geometry: unknown };
type Crosswalk = { psgc: string; comelecCode: string | null };
type VoterRecord = { name: string; registered: number; voted: number; region?: string; province?: string };
type OfficialResult = { name: string; votes: number; percentage: number; rank: number };
type RankFilter = "first" | "top-three" | "four-six" | "seven-twelve" | "outside-twelve";
type CompareLayer = "region" | "province";

const fmt = new Intl.NumberFormat("en-PH");
const regionNames: Record<string, string> = {
  NCR: "NATIONAL CAPITAL REGION", CAR: "CORDILLERA ADMINISTRATIVE REGION", I: "REGION I", II: "REGION II", III: "REGION III",
  CALABARZON: "REGION IV A", MIMAROPA: "REGION IV B", V: "REGION V", VI: "REGION VI", VII: "REGION VII",
  VIII: "REGION VIII", IX: "REGION IX", X: "REGION X", XI: "REGION XI", XII: "REGION XII", XIII: "REGION XIII", BARMM: "BARMM",
};
const rankColor = (rank: number) => rank === 1 ? "#0c4b51" : rank <= 3 ? "#25777b" : rank <= 6 ? "#5fa7a4" : rank <= 12 ? "#a6cfca" : "#d9e5e1";
const geometryPath = (geometry: unknown) => {
  const shape = geometry as { type?: string; coordinates?: unknown };
  const project = (point: number[]) => `${((point[0] - 116) / 11.5 * 300).toFixed(1)},${((22 - point[1]) / 18 * 430).toFixed(1)}`;
  const ring = (points: unknown) => Array.isArray(points) ? `${(points as number[][]).map((point, index) => `${index ? "L" : "M"}${project(point)}`).join("")}Z` : "";
  if (shape.type === "Polygon") return (shape.coordinates as unknown[]).map(ring).join("");
  if (shape.type === "MultiPolygon") return (shape.coordinates as unknown[][]).flatMap((polygon) => polygon.map(ring)).join("");
  return "";
};
const candidateLabel = (candidate: Candidate) => {
  const [surname = "", given = "", ...suffixes] = candidate.name.split(",").map((part) => part.trim());
  if (suffixes.length) return `${given} ${surname}, ${suffixes.join(", ")}`.trim();
  if (given.toUpperCase().endsWith(` ${surname.toUpperCase()}`)) return given;
  return `${given} ${surname}`.trim();
};
const chartRegionOrder = ["NATIONAL CAPITAL REGION", "CORDILLERA ADMINISTRATIVE REGION", "REGION I", "REGION II", "REGION III", "REGION IV A", "REGION IV B", "REGION V", "REGION VI", "REGION VII", "REGION VIII", "REGION IX", "REGION X", "REGION XI", "REGION XII", "REGION XIII", "BARMM"];
const chartRegionLabels: Record<string, string> = {
  "NATIONAL CAPITAL REGION": "NCR", "CORDILLERA ADMINISTRATIVE REGION": "CAR", "REGION I": "R1", "REGION II": "R2",
  "REGION III": "R3", "REGION IV A": "R4A", "REGION IV B": "R4B", "REGION V": "R5", "REGION VI": "R6",
  "REGION VII": "R7", "REGION VIII": "R8", "REGION IX": "R9", "REGION X": "R10",
  "REGION XI": "R11", "REGION XII": "R12", "REGION XIII": "CARAGA", BARMM: "BARMM",
};
const chartAreaLabel = (name: string, layer: CompareLayer) => {
  if (layer !== "region") return name;
  return chartRegionLabels[name.toUpperCase()] ?? name;
};
const key = (value = "") => value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(CITY|MUNICIPALITY)( OF)? /, "").replace(/ CITY$/, "").replace(/[^A-Z0-9]/g, "");
const provinceBoundaryAliases: Record<string, string> = {
  SAMARWESTERNSAMAR: "SAMAR",
  COTABATONORTHCOTABATO: "COTABATO",
};
const provinceResultName = (name = "") => provinceBoundaryAliases[key(name)] ?? name;
const electionRegionForBoundary = (region = "", province = "") => {
  if (region === "NIR") return key(province).includes("OCCIDENTAL") ? "REGION VI" : "REGION VII";
  return regionNames[region] ?? region;
};
const voterRegionAliases: Record<string, string> = { NATIONALCAPITALREGION: "NCR", REGIONXIII: "CARAGA", CORDILLERAADMINISTRATIVEREGION: "CORDILLERA ADM. REGION", BARMM: "B.A.R.M.M." };
const voterLocalityAliases: Record<string, string> = { MANILA: "CITY OF MANILA", CALOOCAN: "CITY OF CALOOCAN", LASPINAS: "CITY OF LAS PIÑAS", PARANAQUE: "CITY OF PARAÑAQUE", GENMARIANOALVAREZ: "GENERAL MARIANO ALVAREZ", GETAFE: "JETAFE", MEYCAUAYAN: "MECAUAYAN", PRESIDENTCARLOSPGARCIA: "PRES. CARLOS P. GARCIA", ROSELLERLIM: "ROSELLER T. LIM", SHARIFFSAYDONAMUSTAPHA: "SHARIFF SAYDONA MUSTHAPA", STOTOMAS: "SANTO TOMAS" };
const voterRegionLookup = new Map((voterGeography.regions as VoterRecord[]).map((record) => [key(record.name), record.registered]));
const voterProvinceLookup = new Map((voterGeography.provinces as VoterRecord[]).map((record) => [key(record.name), record.registered]));
const voterLocalities = voterGeography.localities as VoterRecord[];
const voterLocalityLookup = new Map(voterLocalities.map((record) => [`${key(record.name)}|${key(record.province)}`, record.registered]));
const voterLocalityByName = new Map<string, number>();
for (const record of voterLocalities) if (!voterLocalityByName.has(key(record.name))) voterLocalityByName.set(key(record.name), record.registered); else voterLocalityByName.set(key(record.name), -1);
const electionMunicipalities = electionData.municipalities as CompactRecord[];
const registeredVotersFor = (record: ElectionRecord) => {
  if (record.level === "national") return voterGeography.national.registered;
  if (record.level === "region") return voterRegionLookup.get(key(voterRegionAliases[key(record.name)] ?? record.name)) ?? null;
  if (record.level === "province") {
    const published = voterProvinceLookup.get(key(record.name));
    if (published) return published;
    const childNames = electionMunicipalities.filter((item) => key(item.province ?? "") === key(record.name)).map((item) => item.name);
    const derived = childNames.reduce((sum, name) => sum + Math.max(0, voterLocalityByName.get(key(voterLocalityAliases[key(name)] ?? name)) ?? 0), 0);
    return derived || null;
  }
  const alias = voterLocalityAliases[key(record.name)] ?? record.name;
  const contextual = voterLocalityLookup.get(`${key(alias)}|${key(record.province ?? "")}`);
  const ncrCity = key(record.region ?? "") === "NATIONALCAPITALREGION" ? voterLocalityLookup.get(`${key(alias)}|`) : null;
  const nameOnly = voterLocalityByName.get(key(alias));
  return contextual ?? ncrCity ?? (nameOnly && nameOnly > 0 ? nameOnly : null);
};
const candidateDirectory = electionData.candidates as CandidateDirectoryItem[];
const officialNationalByName = new Map((electionData.officialNationalTop12.results as OfficialResult[]).map((result) => [result.name, result]));
const nationalCompact = { ...(electionData.national as CompactRecord), results: (electionData.national as CompactRecord).results.map((tuple, index) => {
  const official = officialNationalByName.get(candidateDirectory[index].name);
  return official ? [official.votes, official.percentage, official.rank] as [number, number, number] : [tuple[0], Number((tuple[0] / voterGeography.national.voted * 100).toFixed(2)), tuple[2]];
}) };
const compareProvinceRegions = [...new Set((electionData.provinces as CompactRecord[]).map((record) => record.region).filter((region): region is string => Boolean(region)))];
const compareSeriesColors = ["#176d75", "#c9823e", "#7f4f78"];
const rankGroups: { id: RankFilter; label: string; rank: number; matches: (rank: number) => boolean }[] = [
  { id: "first", label: "1st", rank: 1, matches: (rank) => rank === 1 },
  { id: "top-three", label: "2nd–3rd", rank: 2, matches: (rank) => rank >= 2 && rank <= 3 },
  { id: "four-six", label: "4th–6th", rank: 4, matches: (rank) => rank >= 4 && rank <= 6 },
  { id: "seven-twelve", label: "7th–12th", rank: 7, matches: (rank) => rank >= 7 && rank <= 12 },
  { id: "outside-twelve", label: "Outside 12", rank: 13, matches: (rank) => rank > 12 },
];
const hydrateRecord = (record: CompactRecord): ElectionRecord => ({
  ...record,
  candidates: candidateDirectory.map((candidate, index) => ({
    ...candidate,
    votes: record.results[index][0],
    comelecPercentage: record.results[index][1],
    rank: record.results[index][2],
  })).sort((a, b) => a.rank - b.rank || b.votes - a.votes),
});

function AreaSearch({ records, onSelect }: { records: ElectionRecord[]; onSelect: (record: ElectionRecord) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = query.trim() ? records.filter((record) => `${record.name} ${record.level}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  return <div className="election-search"><label><span className="sr-only">Search an area</span><input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search an area" role="combobox" aria-expanded={open && Boolean(query.trim())} aria-controls="election-area-search-results" autoComplete="off" /></label>{open && query.trim() && <div id="election-area-search-results" role="listbox">{matches.length ? matches.map((record) => <button type="button" role="option" aria-selected="false" key={record.code} onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(record.name); setOpen(false); onSelect(record); }}><strong>{record.name}</strong><small>{record.level}</small></button>) : <p>No matching mapped area</p>}</div>}</div>;
}

export default function PhilippineSenateElection2022() {
  const national = hydrateRecord(nationalCompact);
  const candidates = national.candidates;
  const [ballotNumber, setBallotNumber] = useState(49);
  const [layer, setLayer] = useState<Layer>("region");
  const [hovered, setHovered] = useState<MapHover | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("map");
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  const [rankFilter, setRankFilter] = useState<RankFilter | null>(null);
  const [panelMode, setPanelMode] = useState<"area" | "matches">("area");
  const [compareLayer, setCompareLayer] = useState<CompareLayer>("region");
  const [compareBallots, setCompareBallots] = useState([49, 40, 59]);
  const [compareHovered, setCompareHovered] = useState<string | null>(null);
  const [comparePinned, setComparePinned] = useState<string | null>(null);
  const [compareAreaQuery, setCompareAreaQuery] = useState("");
  const [compareAreaOpen, setCompareAreaOpen] = useState(false);
  const [compareProvinceRegion, setCompareProvinceRegion] = useState("REGION I");
  const [chartHovered, setChartHovered] = useState<{ areaId: string; candidateNumber: number; x: number; y: number } | null>(null);
  const maintenanceCloseRef = useRef<HTMLButtonElement>(null);
  const selectedCandidate = candidates.find((candidate) => candidate.ballotNumber === ballotNumber) ?? candidates[0];

  useEffect(() => {
    const sections = ["map", "national", "compare", "source"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActiveSection(visible.target.id);
    }, { rootMargin: "-76px 0px -58%", threshold: [0, .2, .5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMaintenanceLog(false); };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, []);
  useEffect(() => { if (showMaintenanceLog) maintenanceCloseRef.current?.focus(); }, [showMaintenanceLog]);

  const { features, recordsById, searchableRecords } = useMemo(() => {
    const compactRecords = layer === "region" ? electionData.regions as CompactRecord[] : layer === "province" ? electionData.provinces as CompactRecord[] : electionData.municipalities as CompactRecord[];
    const sourceRecords = compactRecords.map(hydrateRecord).map((record) => ({ ...record, registeredVoters: registeredVotersFor(record) }));
    const byCode = new Map(sourceRecords.map((record) => [record.code, record]));
    const byName = new Map<string, ElectionRecord[]>();
    for (const record of sourceRecords) byName.set(key(record.name), [...(byName.get(key(record.name)) ?? []), record]);
    const crosswalk = new Map((geographyCrosswalk.matches as Crosswalk[]).map((item) => [item.psgc, item.comelecCode]));
    const mapRecords = new Map<string, ElectionRecord>();
    const boundaries = layer === "municipality" ? municipalityBoundaries.features as Boundary[] : provinceBoundaries.features as Boundary[];
    const findRecord = (feature: Boundary) => {
      if (layer === "region") return byName.get(key(electionRegionForBoundary(feature.properties.region, feature.properties.province)))?.[0];
      if (layer === "municipality") return byCode.get(crosswalk.get(feature.properties.psgc ?? "") ?? "");
      const candidates = byName.get(key(provinceResultName(feature.properties.province))) ?? [];
      return candidates[0];
    };
    const mapFeatures: MapFeature[] = boundaries.map((feature, index) => {
      const record = findRecord(feature);
      const candidate = record?.candidates.find((item) => item.ballotNumber === ballotNumber);
      const id = record ? `${layer}:${record.code}` : "";
      if (record) mapRecords.set(id, record);
      return {
        type: "Feature",
        id: index,
        geometry: feature.geometry,
        properties: {
          recordId: id,
          eyebrow: `${layer === "municipality" ? "City / municipality" : layer} result`,
          label: record?.name ?? "",
          value: candidate?.rank ?? 0,
          share: candidate?.votes ?? 0,
          fill: candidate ? rankColor(candidate.rank) : "#aebbb7",
          opacity: candidate ? 1 : .15,
          registeredVoters: record?.registeredVoters ?? undefined,
        },
      };
    });
    const mappedCodes = new Set([...mapRecords.values()].map((record) => record.code));
    return { features: mapFeatures, recordsById: mapRecords, searchableRecords: [...byCode.values()].filter((record) => mappedCodes.has(record.code)).sort((a, b) => a.name.localeCompare(b.name)) };
  }, [ballotNumber, layer]);

  const selectedRecord = selectedId ? recordsById.get(selectedId) : null;
  const selectedRegionalCandidate = selectedRecord?.candidates.find((candidate) => candidate.ballotNumber === ballotNumber);
  const activeRankGroup = rankGroups.find((group) => group.id === rankFilter) ?? null;
  const matchingRecords = activeRankGroup ? searchableRecords.map((record) => ({ record, candidate: record.candidates.find((candidate) => candidate.ballotNumber === ballotNumber) })).filter((item): item is typeof item & { candidate: Candidate } => Boolean(item.candidate && activeRankGroup.matches(item.candidate.rank))).sort((a, b) => b.candidate.votes - a.candidate.votes || a.record.name.localeCompare(b.record.name)) : [];
  const highlightedIds = matchingRecords.map(({ record }) => `${layer}:${record.code}`);
  const chooseArea = (record: ElectionRecord) => { const id = `${layer}:${record.code}`; setSelectedId(id); setFocusId(id); setPanelMode("area"); };
  const selectRankGroup = (id: RankFilter) => { if (rankFilter === id) { setRankFilter(null); setPanelMode("area"); } else { setRankFilter(id); setSelectedId(null); setPanelMode("matches"); } };
  const comparison = useMemo(() => {
    const records = (compareLayer === "region" ? electionData.regions : electionData.provinces as CompactRecord[]).map(hydrateRecord).map((record) => ({ ...record, registeredVoters: registeredVotersFor(record) }));
    const byName = new Map(records.map((record) => [key(record.name), record]));
    const shapes = (provinceBoundaries.features as Boundary[]).map((boundary, index) => {
      const recordName = compareLayer === "region" ? electionRegionForBoundary(boundary.properties.region, boundary.properties.province) : provinceResultName(boundary.properties.province);
      const record = byName.get(key(recordName));
      return { id: `${compareLayer}:${record?.code ?? index}`, record, path: geometryPath(boundary.geometry) };
    });
    return { shapes, records: new Map(records.map((record) => [`${compareLayer}:${record.code}`, record])) };
  }, [compareLayer]);
  const comparedAreaId = compareHovered ?? chartHovered?.areaId ?? comparePinned;
  const readoutAreaId = chartHovered ? comparePinned : compareHovered ?? comparePinned;
  const comparedArea = readoutAreaId ? comparison.records.get(readoutAreaId) : null;
  const comparisonAreas = [...comparison.records.entries()].sort(([, a], [, b]) => compareLayer === "region" ? chartRegionOrder.indexOf(a.name.toUpperCase()) - chartRegionOrder.indexOf(b.name.toUpperCase()) : a.name.localeCompare(b.name));
  const exactComparisonArea = comparisonAreas.find(([, record]) => record.name.toLowerCase() === compareAreaQuery.trim().toLowerCase());
  const filteredComparisonAreas = (exactComparisonArea || !compareAreaQuery.trim() ? comparisonAreas : comparisonAreas.filter(([, record]) => record.name.toLowerCase().includes(compareAreaQuery.trim().toLowerCase()))).slice(0, 20);
  const chooseComparisonArea = (value: string) => {
    setCompareAreaQuery(value);
    if (!value.trim()) { setComparePinned(null); return; }
    const match = comparisonAreas.find(([, record]) => record.name.toLowerCase() === value.trim().toLowerCase());
    if (match) { setComparePinned(match[0]); setCompareHovered(null); setChartHovered(null); }
  };
  const chartRecords = [...comparison.records.values()].filter((record) => compareLayer === "region" || record.region === compareProvinceRegion).sort((a, b) => compareLayer === "region" ? chartRegionOrder.indexOf(a.name.toUpperCase()) - chartRegionOrder.indexOf(b.name.toUpperCase()) : a.name.localeCompare(b.name));
  const chartRanks = chartRecords.flatMap((record) => compareBallots.map((candidateNumber) => record.candidates.find((candidate) => candidate.ballotNumber === candidateNumber)?.rank ?? 1));
  const chartMaxRank = Math.max(12, ...chartRanks);
  const chartGridRanks = (chartMaxRank > 30
    ? [1, 3, 6, 9, 12, ...Array.from({ length: Math.ceil((chartMaxRank - 12) / 6) }, (_, index) => Math.min(18 + index * 6, chartMaxRank))]
    : [...Array.from({ length: Math.min(12, chartMaxRank) }, (_, index) => index + 1), ...Array.from({ length: Math.max(0, Math.ceil((chartMaxRank - 12) / 3)) }, (_, index) => Math.min(13 + index * 3, chartMaxRank))]
  ).filter((rank, index, ranks) => index === 0 || rank !== ranks[index - 1]);
  if (chartGridRanks.at(-1) !== chartMaxRank) chartGridRanks.push(chartMaxRank);
  const chartWidth = 1400, chartHeight = 680, chartLeft = 80, chartRight = 34, chartTop = 100, chartBottom = 118;
  const chartX = (index: number) => chartRecords.length <= 1 ? (chartLeft + chartWidth - chartRight) / 2 : chartLeft + index / (chartRecords.length - 1) * (chartWidth - chartLeft - chartRight);
  const chartIslandBands = compareLayer === "region" && chartRecords.length >= 17 ? [
    { name: "Luzon", x1: chartLeft, x2: (chartX(7) + chartX(8)) / 2 },
    { name: "Visayas", x1: (chartX(7) + chartX(8)) / 2, x2: (chartX(10) + chartX(11)) / 2 },
    { name: "Mindanao", x1: (chartX(10) + chartX(11)) / 2, x2: chartWidth - chartRight },
  ] : [];
  const chartY = (rank: number) => chartTop + (rank - 1) / Math.max(1, chartMaxRank - 1) * (chartHeight - chartTop - chartBottom);
  const chartHoveredArea = chartHovered ? comparison.records.get(chartHovered.areaId) : null;
  const chartHoveredCandidate = chartHoveredArea?.candidates.find((candidate) => candidate.ballotNumber === chartHovered?.candidateNumber);

  return <main className="election-results" id="top">
    <header className="dash-nav election-nav">
      <a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a>
      <nav aria-label="Dashboard sections"><a className={activeSection === "map" ? "active" : ""} href="#map">Results map</a><a className={activeSection === "national" ? "active" : ""} href="#national">National ranking</a><a className={activeSection === "compare" ? "active" : ""} href="#compare">Compare</a><a className={activeSection === "source" ? "active" : ""} href="#source">About</a></nav>
    </header>

    <section className="election-hero">
      <div><p className="dash-kicker">Demographics &amp; Social Development</p><h1>National and Local<br /><em>Elections 2022.</em></h1><p className="election-hero-date">May 9, 2022</p><a className="election-hero-source" href="https://2022electionresults.comelec.gov.ph/#/dashboard" target="_blank" rel="noreferrer">Source: Commission on Elections 2022 Election Results ↗</a></div>
      <aside className="election-turnout"><div className="election-turnout-chart" role="img" aria-label="Of 65,745,526 registered voters in the published city and municipality COC table, 55,290,821 or 84.10 percent voted" style={{ background: "conic-gradient(#8ed0cd 0 84.1%,#355f64 84.1% 100%)" }}><div><strong>84.10%</strong><span>turnout</span></div></div><div className="election-turnout-copy"><span>City / municipality COC turnout</span><strong>55,290,821</strong><small>of 65,745,526 registered voters in this geographic table</small><dl><div><dt><i className="voted" />Voted</dt><dd>84.10%</dd></div><div><dt><i className="not-voted" />Did not vote</dt><dd>15.90%</dd></div></dl></div></aside>
    </section>

    <section className="election-map-section" id="map">
      <header className="election-section-head"><div><p className="dash-kicker">Candidate geography</p><h2>Where each candidate ranked</h2></div><div className="election-primary-controls"><label><span>Select a candidate</span><select value={ballotNumber} onChange={(event) => { setBallotNumber(Number(event.target.value)); setSelectedId(null); setRankFilter(null); setPanelMode("area"); }}>{candidates.map((candidate) => <option key={candidate.ballotNumber} value={candidate.ballotNumber}>{candidateLabel(candidate)} · {candidate.party}</option>)}</select></label><div className="layer-tabs" aria-label="Geographic layer">{(["region", "province", "municipality"] as Layer[]).map((item) => <button type="button" key={item} className={layer === item ? "active" : ""} onClick={() => { setLayer(item); setSelectedId(null); setFocusId(null); setHovered(null); setRankFilter(null); setPanelMode("area"); }}>{item === "municipality" ? "City / municipality" : item}</button>)}</div></div></header>
      <div className="election-map-grid">
        <aside className="election-candidate-card"><p>National result</p><span>#{selectedCandidate.rank}</span><h3>{candidateLabel(selectedCandidate)}</h3><b>{selectedCandidate.party}</b><strong>{fmt.format(selectedCandidate.votes)}</strong><small>{selectedCandidate.rank <= 12 ? "official NBOC proclamation total" : "domestic locality sum"}</small><dl><div><dt>Ballot number</dt><dd>{selectedCandidate.ballotNumber}</dd></div><div><dt><abbr title="Candidate votes divided by voters who participated; each voter could select up to 12 candidates.">Candidate vote rate</abbr></dt><dd>{selectedCandidate.comelecPercentage.toFixed(2)}%</dd></div></dl><div className="election-rank-legend" aria-label="Filter areas by local rank"><b>Filter by local rank</b>{rankGroups.map((group) => <button type="button" key={group.id} className={rankFilter === group.id ? "active" : ""} aria-pressed={rankFilter === group.id} onClick={() => selectRankGroup(group.id)}><i style={{ background: rankColor(group.rank) }} /><span>{group.label}</span></button>)}{rankFilter && <button type="button" className="clear" onClick={() => { setRankFilter(null); setPanelMode("area"); }}>Show all ranks</button>}</div></aside>
        <div className="election-map-wrap">
          <AreaSearch key={layer} records={searchableRecords} onSelect={chooseArea} />
          <MapboxChoropleth ariaLabel={`${layer} rank of ${candidateLabel(selectedCandidate)}`} features={features} selectedId={selectedId} focusId={focusId} highlightedIds={highlightedIds} onHover={setHovered} onSelect={(id) => { setSelectedId(id); setPanelMode("area"); }} onClear={() => setSelectedId(null)} />
          {hovered && <div className="election-tooltip"><span>{hovered.label}</span><div className="election-tooltip-summary"><div><strong>#{hovered.value}</strong><small>{fmt.format(hovered.share)} votes</small></div>{hovered.registeredVoters && <div className="election-tooltip-donut" role="img" aria-label={`${(hovered.share / hovered.registeredVoters * 100).toFixed(2)} percent of registered voters`} style={{ background: `conic-gradient(#c9823e 0 ${hovered.share / hovered.registeredVoters * 100}%, #dfe6e3 ${hovered.share / hovered.registeredVoters * 100}% 100%)` }}><b>{(hovered.share / hovered.registeredVoters * 100).toFixed(1)}%</b></div>}</div>{hovered.registeredVoters && <dl><div><dt>Candidate votes</dt><dd>{fmt.format(hovered.share)}</dd></div><div><dt>Registered voters</dt><dd>{fmt.format(hovered.registeredVoters)}</dd></div></dl>}</div>}
        </div>
        <aside className="election-area-card"><div className="election-panel-tabs" role="tablist" aria-label="Area details"><button type="button" role="tab" aria-selected={panelMode === "area"} className={panelMode === "area" ? "active" : ""} onClick={() => setPanelMode("area")}>Selected area</button><button type="button" role="tab" aria-selected={panelMode === "matches"} className={panelMode === "matches" ? "active" : ""} disabled={!rankFilter} onClick={() => setPanelMode("matches")}>Matching places</button></div>{panelMode === "matches" && activeRankGroup ? <div className="election-match-panel"><p>{layer === "municipality" ? "Cities / municipalities" : `${layer}s`} where {candidateLabel(selectedCandidate)} ranked {activeRankGroup.label}</p><strong>{fmt.format(matchingRecords.length)}</strong><small>matching {matchingRecords.length === 1 ? "place" : "places"}</small><ol>{matchingRecords.map(({ record, candidate }) => <li key={record.code}><button type="button" onClick={() => chooseArea(record)}><span className="election-match-heading"><b>{record.name}</b><strong>{fmt.format(candidate.votes)}</strong></span><span className="election-match-meta"><small>Rank #{candidate.rank}</small><small>{record.registeredVoters ? `${(candidate.votes / record.registeredVoters * 100).toFixed(2)}% of registered voters` : "Registered-voter total unavailable"}</small></span><i><em style={{ width: record.registeredVoters ? `${Math.min(100, candidate.votes / record.registeredVoters * 100)}%` : "0%" }} /></i></button></li>)}</ol></div> : selectedRecord && selectedRegionalCandidate ? <><h3>{selectedRecord.name}</h3><div className="election-selected-result"><span>#{selectedRegionalCandidate.rank}</span><div><strong>{fmt.format(selectedRegionalCandidate.votes)}</strong><small>votes for {candidateLabel(selectedCandidate)}</small></div></div>{selectedRecord.registeredVoters && <dl className="election-electorate-context"><div><dt>Registered voters</dt><dd>{fmt.format(selectedRecord.registeredVoters)}</dd></div><div><dt>Candidate votes as share of registered voters</dt><dd>{(selectedRegionalCandidate.votes / selectedRecord.registeredVoters * 100).toFixed(2)}%</dd></div></dl>}<h4>Local top 12 · Share of registered voters</h4><ol className="election-top12-bars">{selectedRecord.candidates.slice(0, 12).map((candidate) => <li key={candidate.ballotNumber} className={candidate.ballotNumber === ballotNumber ? "active" : ""}><span>{candidate.rank}</span><div><strong>{candidateLabel(candidate)}</strong><b>{fmt.format(candidate.votes)}</b><i><em style={{ width: selectedRecord.registeredVoters ? `${Math.min(100, candidate.votes / selectedRecord.registeredVoters * 100)}%` : "0%" }} /></i><small>{selectedRecord.registeredVoters ? `${(candidate.votes / selectedRecord.registeredVoters * 100).toFixed(2)}%` : "—"}</small></div></li>)}</ol></> : <><h3>Choose an area</h3><small>Hover to preview its rank and votes. Click to keep the result here and see its complete local Top 12.</small></>}</aside>
      </div>
    </section>

    <section className="election-national" id="national"><p className="dash-kicker">National canvass</p><h2>The elected twelve</h2><ol>{candidates.slice(0, 12).map((candidate) => <li key={candidate.ballotNumber}><span>{String(candidate.rank).padStart(2, "0")}</span><strong>{candidateLabel(candidate)}<small>{candidate.party}</small></strong><b>{fmt.format(candidate.votes)}</b></li>)}</ol></section>

    <section className="election-compare" id="compare"><header><div><p className="dash-kicker">Side-by-side geography</p><h2>Compare candidates across the country</h2><p><strong className="election-compare-device-note">For the clearest comparison, view this section on a desktop or larger screen.</strong>Hover over any area to read all three results together. Click to pin the comparison.</p></div><div className="layer-tabs" aria-label="Comparison geographic layer">{(["region", "province"] as CompareLayer[]).map((item) => <button type="button" key={item} className={compareLayer === item ? "active" : ""} onClick={() => { setCompareLayer(item); setCompareHovered(null); setComparePinned(null); setCompareAreaQuery(""); setChartHovered(null); }}>{item}</button>)}</div></header><div className="election-compare-maps">{compareBallots.map((candidateNumber, candidateIndex) => { const comparisonCandidate = candidates.find((candidate) => candidate.ballotNumber === candidateNumber) ?? candidates[0]; return <article key={candidateIndex}><label><span>Candidate {candidateIndex + 1}</span><select value={candidateNumber} onChange={(event) => setCompareBallots((current) => current.map((value, index) => index === candidateIndex ? Number(event.target.value) : value))}>{candidates.map((candidate) => <option key={candidate.ballotNumber} value={candidate.ballotNumber}>{candidateLabel(candidate)} · #{candidate.rank}</option>)}</select></label><div className="election-mini-map"><svg viewBox="0 0 300 430" role="img" aria-label={`${compareLayer} ranks for ${candidateLabel(comparisonCandidate)}`}>{comparison.shapes.map((shape, index) => { const result = shape.record?.candidates.find((candidate) => candidate.ballotNumber === candidateNumber); const shapeId = shape.record ? `${compareLayer}:${shape.record.code}` : shape.id; return <path key={index} d={shape.path} fill={result ? rankColor(result.rank) : "#e1e7e4"} className={comparedAreaId === shapeId ? "active" : ""} tabIndex={shape.record ? 0 : -1} onMouseEnter={() => shape.record && setCompareHovered(shapeId)} onMouseLeave={() => setCompareHovered(null)} onFocus={() => shape.record && setCompareHovered(shapeId)} onBlur={() => setCompareHovered(null)} onClick={() => { if (!shape.record) return; const clearing = comparePinned === shapeId; setComparePinned(clearing ? null : shapeId); setCompareAreaQuery(clearing ? "" : shape.record.name); }}><title>{shape.record ? `${shape.record.name}: rank ${result?.rank ?? "unavailable"}` : "No matching result"}</title></path>; })}</svg></div></article>; })}</div><div className="election-compare-readout"><div className="election-compare-area-picker"><label><span>{compareLayer}</span><div className="election-compare-area-combobox"><input value={compareAreaQuery} onChange={(event) => { chooseComparisonArea(event.target.value); setCompareAreaOpen(true); }} onFocus={() => setCompareAreaOpen(true)} onBlur={() => setCompareAreaOpen(false)} placeholder={`Choose or type a ${compareLayer}`} autoComplete="off" role="combobox" aria-expanded={compareAreaOpen} aria-controls="election-comparison-areas" />{compareAreaQuery && <button type="button" className="clear" aria-label="Clear selected area" onMouseDown={(event) => event.preventDefault()} onClick={() => { setCompareAreaQuery(""); setComparePinned(null); setCompareHovered(null); setChartHovered(null); setCompareAreaOpen(false); }}>×</button>}<button type="button" className="toggle" aria-label={`Show ${compareLayer} options`} onMouseDown={(event) => event.preventDefault()} onClick={() => setCompareAreaOpen((open) => !open)}>⌄</button>{compareAreaOpen && <div id="election-comparison-areas" className="election-compare-area-options" role="listbox">{filteredComparisonAreas.length ? filteredComparisonAreas.map(([id, record]) => <button type="button" role="option" aria-selected={comparePinned === id} key={id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCompareAreaQuery(record.name); setComparePinned(id); setCompareHovered(null); setChartHovered(null); setCompareAreaOpen(false); }}>{record.name}</button>) : <p>No matching area</p>}</div>}</div></label><small>{comparedArea ? comparePinned ? "Pinned comparison · choose another area or click the map to change" : "Hover comparison" : "Hover, click, or choose an area"}</small></div>{comparedArea ? compareBallots.map((candidateNumber) => { const candidate = comparedArea.candidates.find((item) => item.ballotNumber === candidateNumber)!; return <dl key={candidateNumber}><dt>{candidateLabel(candidate)}</dt><dd><b>#{candidate.rank}</b><span>{fmt.format(candidate.votes)} votes</span><small>{comparedArea.registeredVoters ? `${(candidate.votes / comparedArea.registeredVoters * 100).toFixed(2)}% of registered voters` : "Electorate share unavailable"}</small></dd></dl>; }) : <p>Hover over or click an area on any map to compare its three candidate results.</p>}</div><div className="election-compare-legend"><b>Local rank</b>{rankGroups.map((group) => <span key={group.id}><i style={{ background: rankColor(group.rank) }} />{group.label}</span>)}</div><div className="election-rank-chart"><header><span>Ranking across places</span>{compareLayer === "province" && <label><span>Region</span><select value={compareProvinceRegion} onChange={(event) => { setCompareProvinceRegion(event.target.value); setCompareHovered(null); setComparePinned(null); setCompareAreaQuery(""); setChartHovered(null); }}>{compareProvinceRegions.map((region) => <option key={region}>{region}</option>)}</select></label>}</header><div className="election-rank-chart-series"><b>Legend</b>{compareBallots.map((candidateNumber, index) => { const candidate = candidates.find((item) => item.ballotNumber === candidateNumber)!; return <span key={candidateNumber}><i style={{ background: compareSeriesColors[index] }} />{candidateLabel(candidate)}</span>; })}<small>Vertical position shows local rank · #1 is highest</small></div><div className="election-rank-chart-wrap"><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Local rankings of three candidates across ${compareLayer === "region" ? "regions" : `provinces in ${compareProvinceRegion}`}`}>{chartIslandBands.map((band, index) => <g key={band.name} className={`island-band band-${index + 1}`}><rect x={band.x1} y={chartTop - 48} width={band.x2 - band.x1} height={chartHeight - chartBottom - chartTop + 48} /><text x={(band.x1 + band.x2) / 2} y={chartTop - 24} textAnchor="middle">{band.name}</text></g>)}{chartGridRanks.map((rank) => <g key={rank}><line x1={chartLeft} x2={chartWidth - chartRight} y1={chartY(rank)} y2={chartY(rank)} className="grid" /><text x={chartLeft - 14} y={chartY(rank) + 5} textAnchor="end">#{rank}</text></g>)}{compareBallots.map((candidateNumber, seriesIndex) => { const points = chartRecords.map((record, index) => { const candidate = record.candidates.find((item) => item.ballotNumber === candidateNumber)!; return { record, candidate, x: chartX(index), y: chartY(candidate.rank), id: `${compareLayer}:${record.code}` }; }); return <g key={candidateNumber} className="series" style={{ color: compareSeriesColors[seriesIndex] }}><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />{points.map((point) => <circle key={point.id} cx={point.x} cy={point.y} r="3" tabIndex={0} onMouseEnter={() => { setChartHovered({ areaId: point.id, candidateNumber, x: point.x, y: point.y }); setCompareHovered(point.id); }} onMouseLeave={() => { setChartHovered(null); setCompareHovered(null); }} onFocus={() => { setChartHovered({ areaId: point.id, candidateNumber, x: point.x, y: point.y }); setCompareHovered(point.id); }} onBlur={() => { setChartHovered(null); setCompareHovered(null); }} onClick={() => { const clearing = comparePinned === point.id; setComparePinned(clearing ? null : point.id); setCompareAreaQuery(clearing ? "" : point.record.name); }}><title>{`${point.record.name}: ${candidateLabel(point.candidate)} ranked #${point.candidate.rank}`}</title></circle>)}</g>; })}{chartRecords.map((record, index) => <text key={record.code} x={chartX(index)} y={chartHeight - chartBottom + 28} transform={compareLayer === "region" ? undefined : `rotate(-42 ${chartX(index)} ${chartHeight - chartBottom + 28})`} textAnchor={compareLayer === "region" ? "middle" : "end"} className="area-label">{chartAreaLabel(record.name, compareLayer)}</text>)}</svg>{chartHovered && chartHoveredArea && chartHoveredCandidate && <div className={`election-rank-chart-tooltip${chartHovered.x / chartWidth > 0.78 ? " edge-right" : ""}`} style={{ left: `${chartHovered.x / chartWidth * 100}%`, top: `${chartHovered.y / chartHeight * 100}%` }}><b>{chartHoveredArea.name}</b><span>{candidateLabel(chartHoveredCandidate)}</span><strong>Rank #{chartHoveredCandidate.rank}</strong><small>{fmt.format(chartHoveredCandidate.votes)} votes</small><small>{chartHoveredArea.registeredVoters ? `${(chartHoveredCandidate.votes / chartHoveredArea.registeredVoters * 100).toFixed(2)}% of registered voters` : "Electorate share unavailable"}</small></div>}</div><p>Lines connect categorical areas to make candidate rankings easier to compare; they do not represent a continuous geographic trend.</p></div></section>

    <section className="electorate-continue"><div><p className="dash-kicker">Other election editions</p><h2>Continue to the<br /><em>2025 election.</em></h2></div><div><p>Explore the next national and local election using the same geographic ranking framework.</p><a href="/dashboards/nle-2025">Explore NLE 2025 <span>→</span></a></div></section>

    <section className="source-section electorate-source election-source" id="source"><p className="dash-kicker">About the data</p><h2>Sources and Methodology</h2><div className="electorate-source-grid"><article><b>Election results</b><a href="https://2022electionresults.comelec.gov.ph/#/coc" target="_blank" rel="noreferrer">COMELEC 2022 COC Results ↗</a><p>The public results portal was last updated 27 May 2022 at 3:09:53 PM. Locality records are preserved from a corrected scrape of its JSON API.</p></article><article><b>Voter turnout and electorate</b><a href="https://comelec.gov.ph/?r=2022NLE/Statistics/2022RVVAVmcocfinal" target="_blank" rel="noreferrer">COMELEC 2022 NLE Statistics ↗</a><p>The displayed 65,745,526 registered voters and 55,290,821 who voted are the totals in COMELEC’s published city/municipality COC table. Overseas voting and the separately reported 63 BARMM barangays are outside this geographic table, so these figures are not the all-mode national electorate total.</p></article><article><b>National canvass</b><a href="https://comelec.gov.ph/php-tpls-attachments/2022NLE/ElectionResults/2022NLE_SenatorialSummaryStatementofVotes.pdf" target="_blank" rel="noreferrer">COMELEC Senatorial Summary ↗</a><p>The elected twelve use the official NBOC proclamation totals based on 172 of 173 COCs; these totals include overseas absentee votes.</p></article><article><b>Ranking</b><p>Candidates are ranked by reported votes within each geography. Tied vote totals share the same rank.</p></article><article><b>Download data</b><a href="/downloads/nle-2022-data.zip" download>Download NLE 2022 CSV archive ↗</a><p>One CSV row per candidate per geography, including votes, rank, percentage definition, electorate context, calculated shares, source URLs, and whether each result is official or derived.</p></article><article><b>Coverage</b><p>Includes all 64 ballot candidates, 17 regions, 85 province/district groupings, and 1,634 city/municipality results. Regional and complete-candidate national working records are derived from published locality results.</p></article><article><b>Map boundaries</b><p>All 1,634 published locality results match the 1,647 map polygons. Manila’s single city result is intentionally repeated across its 14 district polygons.</p></article><article><b>Percentages</b><p>Electorate share divides candidate votes by registered voters and is not turnout. National winners use NBOC vote rates; other national candidates use locality sums and participation from the published city/municipality table.</p></article><article className="electorate-source-history"><b>Dashboard history</b><dl><div><dt>Created</dt><dd>28 August 2026</dd></div><div><dt>Last reviewed</dt><dd>28 August 2026</dd></div><div><dt>Last updated</dt><dd>28 August 2026</dd></div></dl><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log</button></article></div></section>
    {showMaintenanceLog && <div className="electorate-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}><section className="electorate-change-log" role="dialog" aria-modal="true" aria-labelledby="election-log-title"><header><div><p className="dash-kicker">Dashboard history</p><h2 id="election-log-title">Maintenance Log</h2></div><button ref={maintenanceCloseRef} type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header><div className="electorate-log-entries"><article><time dateTime="2026-08-28">28 August 2026</time><h3>Reliability and accessibility QA</h3><p>Validated 111,168 candidate-result tuples, every aggregate and rank, all 1,634 election-to-electorate joins, and the complete boundary crosswalk. Corrected 23 electorate label joins involving accents, abbreviations, and NCR district context; clarified the scope of the city/municipality turnout figure; added the historical Luzon, Visayas, and Mindanao regional bands; and improved keyboard and dialog semantics.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>Dashboard created and validated</h3><p>Built the separate 2022 election-results explorer using COMELEC’s Senate results and final city/municipality electorate table. Verified the 64-candidate ballot order, official NBOC Top 12, complete candidate arrays for all 1,634 localities, geographic rankings, electorate shares, and the full boundary crosswalk.</p></article></div><footer><time dateTime="2022-05-27">Results snapshot</time><p>COMELEC election-results portal last updated 27 May 2022 at 3:09:53 PM.</p></footer></section></div>}
    <a className="back-to-top" href="#top" aria-label="Back to top" title="Back to top">↑</a>
    <footer className="dash-footer election-footer"><a href="/">← Back to Factbook</a><span>Demographics &amp; Social Development · Election 2022</span></footer>
  </main>;
}
