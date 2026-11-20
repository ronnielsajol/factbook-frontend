"use client";

import { useEffect, useMemo, useState } from "react";

type PovertyRow = { poverty: number; province: string; regional: number; provincial: number };
type SortKey = keyof PovertyRow;
type ProvinceRecord = { name: string; level: string; enns_year: number | null; enns_prevalence: number | null; opt_2025_prevalence: number | null; source: string };
type AnnexArea = { name: string; year: number | null; enns: number | null; opt: number | string | null };
type AnnexRegion = { name: string; enns: number; areas: string[] };
type GeoJsonFeature<T> = { properties: T };
type GeoJsonPart<T> = { features: GeoJsonFeature<T>[] };
type GeoJsonManifest = { files: string[] };

async function fetchDashboardJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  if (!url.endsWith(".gz")) return response.json() as Promise<T>;

  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return JSON.parse(new TextDecoder().decode(bytes)) as T;

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json() as Promise<T>;
}

async function loadProvinceRecords() {
  const manifest = await fetchDashboardJson<GeoJsonManifest>(
    "/stunting/data/province-manifest.json",
  );
  const parts = await Promise.all(
    manifest.files.map((file) =>
      fetchDashboardJson<GeoJsonPart<ProvinceRecord>>(`/stunting/data/${file}`),
    ),
  );
  return parts.flatMap((part) => part.features.map((feature) => feature.properties));
}

const ennsHucRows: readonly [string, number, number][] = [
  ["Angeles City", 2019, 17], ["City of Olongapo", 2018, 23.4], ["Iloilo City", 2018, 30.8], ["Bacolod City", 2021, 29.7],
  ["Cebu City", 2021, 27.9], ["Mandaue City", 2018, 24.3], ["Lapu-Lapu City", 2019, 27.8], ["Tacloban City", 2018, 33.5],
  ["City of Isabela", 2018, 29.5], ["Zamboanga City", 2019, 33.1], ["City of Cagayan de Oro", 2018, 23.4], ["Iligan City", 2021, 30.2],
  ["Davao City", 2018, 30.9], ["General Santos City", 2021, 23.5], ["City of Manila", 2018, 27.6], ["Mandaluyong City", 2018, 21.2],
  ["City of Marikina", 2019, 18.5], ["City of Pasig", 2021, 12.4], ["Quezon City", 2018, 29.9], ["San Juan City", 2018, 23.1],
  ["Caloocan City", 2018, 23.2], ["City of Malabon", 2019, 31.2], ["City of Navotas", 2021, 11.9], ["City of Valenzuela", 2021, 16.3],
  ["Las Piñas City", 2018, 25.8], ["Makati City", 2018, 19.6], ["City of Muntinlupa", 2021, 34.4], ["City of Parañaque", 2019, 30.2],
  ["Pasay City", 2021, 13.5], ["Pateros", 2019, 20.5], ["Taguig City", 2018, 19.9], ["Baguio City", 2018, 23.4],
  ["Cotabato City", 2021, 27.6], ["Butuan City", 2018, 31.1], ["Lucena City", 2021, 30], ["Puerto Princesa City", 2019, 26.5],
];

function areaKey(value: string) {
  return value.toLowerCase().replaceAll("city of ", "").replaceAll(" city", "").replaceAll(" province", "").replaceAll("(capital)", "").replaceAll("ñ", "n").replaceAll("western samar", "samar").replaceAll("north cotabato", "cotabato").replaceAll("compostela valley", "davao de oro").replace(/[^a-z0-9]/g, "");
}

const annexRegions: AnnexRegion[] = [
  { name: "Region I – Ilocos Region", enns: 20.7, areas: ["Ilocos Norte", "Ilocos Sur", "La Union", "Pangasinan"] },
  { name: "Region II – Cagayan Valley", enns: 27.8, areas: ["Batanes", "Cagayan Province", "Isabela Province", "Nueva Vizcaya", "Quirino"] },
  { name: "Region III – Central Luzon", enns: 19.7, areas: ["Bataan", "Bulacan", "Nueva Ecija", "Pampanga", "Tarlac", "Zambales", "Aurora", "Angeles City", "City of Olongapo"] },
  { name: "Region IV-A – CALABARZON", enns: 23.7, areas: ["Batangas", "Cavite", "Laguna", "Quezon Province", "Rizal", "Lucena City"] },
  { name: "MIMAROPA Region", enns: 33.4, areas: ["Marinduque", "Occidental Mindoro", "Oriental Mindoro", "Palawan", "Romblon", "Puerto Princesa City"] },
  { name: "Region V – Bicol Region", enns: 32.6, areas: ["Albay", "Camarines Norte", "Camarines Sur", "Catanduanes", "Masbate", "Sorsogon"] },
  { name: "Region VI – Western Visayas", enns: 36.9, areas: ["Aklan", "Antique", "Capiz", "Iloilo Province", "Negros Occidental", "Guimaras", "Iloilo City", "Bacolod City"] },
  { name: "Region VII – Central Visayas", enns: 29.9, areas: ["Bohol", "Cebu", "Negros Oriental", "Siquijor", "Cebu City", "Mandaue City", "Lapu-Lapu City"] },
  { name: "Region VIII – Eastern Visayas", enns: 32.3, areas: ["Eastern Samar", "Leyte", "Northern Samar", "Western Samar", "Southern Leyte", "Biliran", "Tacloban City"] },
  { name: "Region IX – Zamboanga Peninsula", enns: 35.6, areas: ["Zamboanga del Norte", "Zamboanga del Sur", "Zamboanga Sibugay", "City of Isabela", "Zamboanga City"] },
  { name: "Region X – Northern Mindanao", enns: 30.7, areas: ["Bukidnon", "Camiguin", "Lanao del Norte", "Misamis Occidental", "Misamis Oriental", "City of Cagayan de Oro", "Iligan City"] },
  { name: "Region XI – Davao Region", enns: 28, areas: ["Davao del Norte", "Davao del Sur", "Davao Oriental", "Davao de Oro", "Davao Occidental", "Davao City"] },
  { name: "Region XII – SOCCSKSARGEN", enns: 30.9, areas: ["Cotabato Province", "South Cotabato", "Sultan Kudarat", "Sarangani", "General Santos City"] },
  { name: "National Capital Region (NCR)", enns: 24.3, areas: ["City of Manila", "Mandaluyong City", "City of Marikina", "City of Pasig", "Quezon City", "San Juan City", "Caloocan City", "City of Malabon", "City of Navotas", "City of Valenzuela", "Las Piñas City", "Makati City", "City of Muntinlupa", "City of Parañaque", "Pasay City", "Pateros", "Taguig City"] },
  { name: "Cordillera Administrative Region (CAR)", enns: 25.9, areas: ["Abra", "Benguet", "Ifugao", "Kalinga", "Mountain Province", "Apayao", "Baguio City"] },
  { name: "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)", enns: 36, areas: ["Basilan", "Lanao del Sur", "Maguindanao", "Sulu", "Tawi-Tawi", "Cotabato City"] },
  { name: "Caraga", enns: 29.6, areas: ["Agusan del Norte", "Agusan del Sur", "Surigao del Norte", "Surigao del Sur", "Dinagat Islands", "Butuan City"] },
];

const annexHucOpt: Record<string, number> = Object.fromEntries([
  ["Angeles City",2.4],["City of Olongapo",1.8],["Iloilo City",1.4],["Bacolod City",3.4],["Cebu City",3.3],["Mandaue City",3.7],["Lapu-Lapu City",1.5],["Tacloban City",11],["City of Isabela",3.7],["Zamboanga City",1.4],["City of Cagayan de Oro",.3],["Iligan City",1.4],["Davao City",5.6],["General Santos City",2.6],["City of Manila",5.2],["Mandaluyong City",.2],["City of Marikina",.5],["City of Pasig",1.4],["Quezon City",.8],["San Juan City",1],["Caloocan City",1.4],["City of Malabon",2.5],["City of Navotas",1.1],["City of Valenzuela",.8],["Las Piñas City",1.5],["Makati City",.2],["City of Muntinlupa",.4],["City of Parañaque",2.5],["Pasay City",1.9],["Pateros",4.3],["Taguig City",.2],["Baguio City",5.5],["Cotabato City",3.2],["Butuan City",1],["Lucena City",4.7],["Puerto Princesa City",9.6]
].map(([name, value]) => [areaKey(String(name)), Number(value)]));

const povertyRows: PovertyRow[] = [
  { poverty: 1, province: "Zamboanga del Norte", regional: 3, provincial: 7 },
  { poverty: 2, province: "Basilan", regional: 2, provincial: 8 },
  { poverty: 3, province: "Cotabato City", regional: 7, provincial: 68 },
  { poverty: 4, province: "Tawi-Tawi", regional: 2, provincial: 25 },
  { poverty: 5, province: "Maguindanao", regional: 2, provincial: 5 },
  { poverty: 6, province: "Davao Oriental", regional: 11, provincial: 69 },
  { poverty: 7, province: "Sorsogon", regional: 5, provincial: 60 },
  { poverty: 8, province: "Sultan Kudarat", regional: 7, provincial: 1 },
  { poverty: 9, province: "Lanao del Norte", regional: 8, provincial: 34 },
  { poverty: 10, province: "Negros Oriental", regional: 9, provincial: 36 },
  { poverty: 11, province: "Samar", regional: 6, provincial: 2 },
  { poverty: 12, province: "Eastern Samar", regional: 6, provincial: 31 },
  { poverty: 13, province: "Catanduanes", regional: 5, provincial: 48 },
  { poverty: 14, province: "Agusan del Sur", regional: 10, provincial: 32 },
  { poverty: 15, province: "Sarangani", regional: 7, provincial: 18 },
  { poverty: 16, province: "Dinagat Islands", regional: 10, provincial: 77 },
  { poverty: 17, province: "Romblon", regional: 4, provincial: 40 },
  { poverty: 18, province: "Misamis Occidental", regional: 8, provincial: 79 },
  { poverty: 19, province: "Camarines Sur", regional: 5, provincial: 28 },
  { poverty: 20, province: "Negros Occidental", regional: 1, provincial: 4 },
];

function rankClass(value: number) {
  if (value <= 5) return "top-five";
  if (value <= 8) return "six-eight";
  if (value <= 10) return "nine-ten";
  return "unranked";
}

export default function HistoricalContext() {
  const [sort, setSort] = useState<SortKey>("poverty");
  const [ascending, setAscending] = useState(true);
  const [annexView, setAnnexView] = useState<"Region" | "Province" | "City">("Province");
  const [provinceRecords, setProvinceRecords] = useState<ProvinceRecord[]>([]);
  useEffect(() => {
    let active = true;
    loadProvinceRecords()
      .then((records) => {
        if (active) setProvinceRecords(records);
      })
      .catch(() => {
        if (active) setProvinceRecords([]);
      });

    return () => {
      active = false;
    };
  }, []);
  const rows = useMemo(() => [...povertyRows].sort((a, b) => {
    const compared = typeof a[sort] === "string" ? String(a[sort]).localeCompare(String(b[sort])) : Number(a[sort]) - Number(b[sort]);
    return ascending ? compared : -compared;
  }), [sort, ascending]);
  const chooseSort = (key: SortKey) => { if (sort === key) setAscending((value) => !value); else { setSort(key); setAscending(true); } };
  const annexAreaLookup = useMemo(() => {
    const lookup = new Map<string, AnnexArea>();
    provinceRecords.forEach((record) => lookup.set(areaKey(record.name), { name: record.name, year: record.enns_year, enns: record.enns_prevalence, opt: record.opt_2025_prevalence }));
    ennsHucRows.forEach(([name, year, enns]) => lookup.set(areaKey(name), { name, year, enns, opt: annexHucOpt[areaKey(name)] ?? null }));
    lookup.set(areaKey("Maguindanao"), { name: "Maguindanao", year: null, enns: null, opt: "3.8% (North), 4.1% (South)" });
    lookup.set(areaKey("Sulu"), { name: "Sulu", year: null, enns: null, opt: 5.4 });
    return lookup;
  }, [provinceRecords]);
  const annexCityKeys = useMemo(() => new Set(ennsHucRows.map(([name]) => areaKey(name))), []);
  const annexFilteredAreas = useMemo(() => annexRegions.flatMap((region) => region.areas.map((name) => ({ region: region.name, name, area: annexAreaLookup.get(areaKey(name)) }))).filter((record) => annexView === "City" ? annexCityKeys.has(areaKey(record.name)) : !annexCityKeys.has(areaKey(record.name))), [annexAreaLookup, annexCityKeys, annexView]);

  return <>
    <article className="stunting-native-block">
      <div className="stunting-flourish-copy"><span>01 · Poverty incidence and stunting rank</span><h3>Do the poorest provinces also rank high in stunting?</h3><p>This table combines PSA 2023 poverty rankings with regional and provincial stunting rankings from ENNS 2018–2021. It is historical context, not a 2025 comparison.</p></div>
      <div className="native-poverty-table">
        <div className="native-table-summary"><p><small>Finding 01</small><strong>7 of 20</strong> poorest provinces are also among the 20 provinces with the highest stunting prevalence.</p><p><small>Finding 02</small><strong>9 of 20</strong> belong to the five regions with the highest prevalence.</p></div>
        <div className="native-table-scroll"><table><thead><tr>{([['poverty','Poverty rank'],['province','Province'],['regional','Regional stunting rank'],['provincial','Provincial stunting rank']] as [SortKey,string][]).map(([key,label]) => <th key={key} aria-sort={sort === key ? ascending ? "ascending" : "descending" : "none"}><button onClick={() => chooseSort(key)}>{label}{sort === key && <span aria-hidden="true">{ascending ? "↑" : "↓"}</span>}</button></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.province}><td>{row.poverty}</td><th scope="row">{row.province}</th><td className={rankClass(row.regional)}>{row.regional}</td><td className={rankClass(row.provincial)}>{row.provincial}</td></tr>)}</tbody></table></div>
        <div className="native-rank-key"><span><i className="top-five" />Rank 1–5</span><span><i className="six-eight" />Rank 6–8</span><span><i className="nine-ten" />Rank 9–10</span><small>PSA 2023 poverty incidence · ENNS 2018–2021 stunting</small></div>
      </div>
    </article>

    <article className="stunting-native-block stunting-all-data">
      <div className="stunting-flourish-copy"><span>02 · Regional, provincial, and HUC records</span><h3>Explore records by geographic level.</h3><p>Begin with province-level records, or switch to the regional overview and highly urbanized city data. Province and city entries retain their ENNS collection year and show the reported Operation Timbang Plus value alongside it.</p></div>
      <div className="province-explorer annex-explorer">
        <nav className="annex-view-filter" aria-label="Filter records by geography">{(["Region", "Province", "City"] as const).map((view) => <button key={view} type="button" className={annexView === view ? "active" : ""} aria-pressed={annexView === view} onClick={() => setAnnexView(view)}>{view}</button>)}</nav>
        <div className="province-explorer-scroll annex-table-scroll"><table className="annex-table"><colgroup><col className="annex-name-col" /><col className="annex-year-col" /><col className="annex-value-col" /><col className="annex-opt-col" /></colgroup><thead><tr><th><small>Geography</small>{annexView === "Region" ? "Region" : annexView === "Province" ? "Province" : "Highly urbanized city"}</th><th><small>Reference</small>Year collected</th><th><small>Survey estimate</small>DOST–FNRI ENNS prevalence</th><th><small>Administrative measure</small>Operation Timbang Plus prevalence</th></tr></thead><tbody>
          {annexView === "Region" ? annexRegions.map((region) => <tr className="annex-region-row" key={region.name}><th scope="row">{region.name}</th><td></td><td><b>{region.enns}%</b></td><td></td></tr>) : annexFilteredAreas.map(({ region, name, area }) => <tr className="annex-area-row" key={`${region}-${name}`}><th scope="row">{name}<small>{region}</small></th><td>{area?.year ?? <span className="data-na">Not available</span>}</td><td>{area?.enns !== null && area?.enns !== undefined ? <b>{area.enns}%</b> : <span className="data-na">Not available</span>}</td><td>{area?.opt !== null && area?.opt !== undefined ? <b>{typeof area.opt === "number" ? `${area.opt}%` : area.opt}</b> : <span className="data-na">Not available</span>}</td></tr>)}
        </tbody></table></div>
        <aside className="province-explorer-note"><div className="comparison-note"><h4>A note on comparison</h4><p>Provincial estimates from the 2018, 2019, and 2021 DOST–FNRI Expanded National Nutrition Survey are shown alongside Operation Timbang Plus results. Because the sources differ in sampling, coverage, and data collection—and OPT+ may underestimate stunting—the differences should not be interpreted as confirmed improvement or deterioration.</p></div><div className="annex-source-links"><h4>Official sources</h4><ul><li><a href="https://enutrition.fnri.dost.gov.ph/facts-and-figures.php?year=2021" target="_blank" rel="noreferrer">DOST–FNRI Expanded National Nutrition Survey results, 2018–2021 <span aria-hidden="true">↗</span></a></li><li><a href="https://nnc.gov.ph/plans-and-programs/philippine-nutrition-surveillance-system-pnss/operation-timbang-plus-otp/" target="_blank" rel="noreferrer">National Nutrition Council, Operation Timbang Plus <span aria-hidden="true">↗</span></a></li></ul></div></aside>
      </div>
    </article>
  </>;
}
