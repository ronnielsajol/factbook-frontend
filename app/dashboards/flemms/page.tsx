"use client";

import { useEffect, useMemo, useState } from "react";
import data from "../../../data/generated/flemms-2024.json";
import provinceBoundaries from "../../../data/generated/philippines-provinces-simplified.json";
import MapboxChoropleth, { type MapFeature } from "../philippine-electorate/MapboxChoropleth";

type Sex = "all" | "female" | "male";
type LiteracyMetric = "basic" | "functional";
type RegionOrder = "sequence" | "descending" | "ascending";
type MediaGroup = "region" | "age";
type MediaPoint = { name: string; label: string; value: number; x: number; y: number; className: string; mode: "hover" | "click" };
type LiteracyRecord = { name: string; basic: number; basicMale: number; basicFemale: number; functional: number; functionalMale: number; functionalFemale: number };
type InternetRecord = { name: string; workResearch: number; socialMedia: number; ecommerce: number; governmentFinance: number };
type ReadingRecord = { name: string; printNewspaper: number; digitalNewspaper: number; printMagazine: number; printPosters: number };
type TrendRecord = { name: string; "2019": number | null; "2024": number };
type SlopePoint = { name: string; start: number; end: number; y: number; direction: "up" | "down"; mode: "hover" | "click" };
type Boundary = { properties: { province?: string; region?: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };

const pct = (value: number) => `${value.toFixed(1)}%`;
const pts = (value: number) => `${value.toFixed(1)}`;
const shortName = (name: string) => name.replace(/ \(.+\)$/, "").replace("Cordillera Administrative Region", "CAR").replace("National Capital Region", "NCR").replace("Region XIII", "Caraga");
const sexSuffix: Record<Sex, "" | "Female" | "Male"> = { all: "", female: "Female", male: "Male" };
const internetLabels = { workResearch: "Work & research", socialMedia: "Social media", ecommerce: "E-commerce", governmentFinance: "Government & finance" } as const;
const internetSeries = [
  { key: "workResearch", label: "Work & research", className: "work" },
  { key: "socialMedia", label: "Social media", className: "social" },
  { key: "ecommerce", label: "E-commerce", className: "commerce" },
  { key: "governmentFinance", label: "Government & finance", className: "government" },
] as const;
const mapRegionNames: Record<string, string> = { NCR: "National Capital Region (NCR)", CAR: "Cordillera Administrative Region (CAR)", I: "Region I (Ilocos Region)", II: "Region II (Cagayan Valley)", III: "Region III (Central Luzon)", CALABARZON: "Region IV-A (CALABARZON)", MIMAROPA: "MIMAROPA Region", V: "Region V (Bicol Region)", VI: "Region VI (Western Visayas)", NIR: "Negros Island Region (NIR)", VII: "Region VII (Central Visayas)", VIII: "Region VIII (Eastern Visayas)", IX: "Region IX (Zamboanga Peninsula)", X: "Region X (Northern Mindanao)", XI: "Region XI (Davao Region)", XII: "Region XII (SOCCSKSARGEN)", XIII: "Region XIII (Caraga)", BARMM: "BARMM" };
const project = ([lon, lat]: number[]) => [45 + ((lon - 116) / 11) * 470, ((21.5 - lat) / 17.5) * 820];
const ringPath = (ring: number[][]) => ring.map((point, index) => `${index ? "L" : "M"}${project(point).map((n) => n.toFixed(1)).join(" ")}`).join("") + "Z";
const featurePath = (feature: Boundary) => feature.geometry.type === "Polygon" ? (feature.geometry.coordinates as number[][][]).map(ringPath).join("") : (feature.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon.map(ringPath)).join("");
const slopeY = (value: number) => 70 + ((100 - value) / 100) * 540;
const trendShortName = (name: string) => name.replace("Movies, Plays, and Similar Shows (cinema/dvd/vcd players)", "Movies, plays & similar shows");
const spreadSlopeLabels = (items: TrendRecord[], year: "2019" | "2024") => {
  const positions = new Map<string, number>();
  let previous = 20;
  [...items].sort((a, b) => slopeY((a[year] ?? 0) as number) - slopeY((b[year] ?? 0) as number)).forEach((item) => {
    const position = Math.max(slopeY((item[year] ?? 0) as number), previous + 34);
    positions.set(item.name, position);
    previous = position;
  });
  return positions;
};

function rate(record: LiteracyRecord, metric: LiteracyMetric, sex: Sex) {
  return record[`${metric}${sexSuffix[sex]}` as keyof LiteracyRecord] as number;
}

export default function FlemmsDashboard() {
  const [metric, setMetric] = useState<LiteracyMetric>("functional");
  const [sex, setSex] = useState<Sex>("all");
  const [selectedRegion, setSelectedRegion] = useState<LiteracyRecord | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<LiteracyRecord | null>(null);
  const [ageSex, setAgeSex] = useState<Sex>("all");
  const [regionOrder, setRegionOrder] = useState<RegionOrder>("sequence");
  const [mediaGroup, setMediaGroup] = useState<MediaGroup>("region");
  const [mediaPlace, setMediaPlace] = useState("Philippines");
  const [readingPlace, setReadingPlace] = useState("Philippines");
  const [mediaPoint, setMediaPoint] = useState<MediaPoint | null>(null);
  const [slopePoint, setSlopePoint] = useState<SlopePoint | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const dismissTransientUi = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMediaPoint(null);
      setSlopePoint(null);
      setHistoryOpen(false);
    };
    const dismissPinnedCards = () => {
      setMediaPoint(null);
      setSlopePoint(null);
    };
    window.addEventListener("keydown", dismissTransientUi);
    document.addEventListener("pointerdown", dismissPinnedCards);
    return () => {
      window.removeEventListener("keydown", dismissTransientUi);
      document.removeEventListener("pointerdown", dismissPinnedCards);
    };
  }, []);

  const ranked = useMemo(() => [...data.regions].sort((a, b) => rate(b, metric, sex) - rate(a, metric, sex)), [metric, sex]);
  const media = data.internet.find((item) => item.name === mediaPlace) as InternetRecord ?? data.internet[0] as InternetRecord;
  const mediaOptions = data.internet.filter((item) => mediaGroup === "age" ? /^\d/.test(item.name) : !/^\d/.test(item.name));
  const readingOptions = data.reading.filter((item) => !/^\d/.test(item.name)) as ReadingRecord[];
  const selectedReading = (data.reading.find((item) => item.name === readingPlace) ?? data.reading[0]) as ReadingRecord;
  const mediaComparison = mediaOptions.filter((item) => item.name !== "Philippines") as InternetRecord[];
  const mediaLineX = (index: number) => 75 + index * (1510 / Math.max(mediaComparison.length - 1, 1));
  const mediaLineY = (value: number) => 30 + ((100 - value) / 100) * 350;
  const mediaLinePoints = (key: keyof typeof internetLabels) => mediaComparison.map((item, index) => `${mediaLineX(index)},${mediaLineY(item[key])}`).join(" ");
  const showMediaPoint = (item: InternetRecord, index: number, key: keyof typeof internetLabels, label: string, className: string, mode: "hover" | "click") => setMediaPoint({ name: shortName(item.name), label, value: item[key], x: mediaLineX(index), y: mediaLineY(item[key]), className, mode });
  const slopeTrends = (data.trends.slice(0, 9) as TrendRecord[]).filter((item) => item["2019"] !== null);
  const newTrends = (data.trends.slice(0, 9) as TrendRecord[]).filter((item) => item["2019"] === null);
  const slopeLabels2019 = spreadSlopeLabels(slopeTrends, "2019");
  const slopeLabels2024 = spreadSlopeLabels(slopeTrends, "2024");
  const national = data.national as LiteracyRecord;
  const gap = national.basic - national.functional;
  const regionByName = new Map(data.regions.map((region) => [region.name, region as LiteracyRecord]));
  const mapFeatures = provinceBoundaries.features as Boundary[];
  const mapRecord = (feature: Boundary) => regionByName.get(mapRegionNames[feature.properties.region ?? ""]);
  const mapValues = data.regions.map((region) => rate(region as LiteracyRecord, metric, sex));
  const mapMin = Math.floor(Math.min(...mapValues) / 5) * 5;
  const mapMax = Math.ceil(Math.max(...mapValues) / 5) * 5;
  const metricColor = metric === "basic" ? "#287a5b" : "#e36f52";
  const activeColor = sex === "female" ? "#b94e57" : sex === "male" ? "#173f67" : metricColor;
  const bandStep = 5;
  const legendBands = Array.from({ length: Math.max(1, Math.ceil((mapMax - mapMin) / bandStep)) }, (_, index) => ({ min: mapMin + index * bandStep, max: Math.min(mapMin + (index + 1) * bandStep, mapMax), opacity: .2 + (index / Math.max(Math.ceil((mapMax - mapMin) / bandStep) - 1, 1)) * .8 }));
  const mapOpacity = (value: number) => legendBands.find((band, index) => value >= band.min && (index === legendBands.length - 1 ? value <= band.max : value < band.max))?.opacity ?? .2;
  const mapboxFeatures: MapFeature[] = mapFeatures.map((feature, index) => { const region = mapRecord(feature); const value = region ? rate(region, metric, sex) : 0; return { type: "Feature", id: index, geometry: feature.geometry, properties: { recordId: region?.name ?? `unmatched-${index}`, eyebrow: "Region", label: region?.name ?? "No regional match", value, share: value, fill: activeColor, opacity: region ? mapOpacity(value) : .06 } }; });
  const sexLabel = sex === "all" ? "Both sexes" : sex[0].toUpperCase() + sex.slice(1);
  const mapTooltipRegion = hoveredRegion ?? selectedRegion;
  const chartRegions = useMemo(() => {
    const regions = [...data.regions] as LiteracyRecord[];
    if (regionOrder === "descending") return regions.sort((a, b) => rate(b, "functional", sex) - rate(a, "functional", sex));
    if (regionOrder === "ascending") return regions.sort((a, b) => rate(a, "functional", sex) - rate(b, "functional", sex));
    return regions;
  }, [regionOrder, sex]);
  const lineX = (index: number) => 70 + index * (1530 / Math.max(chartRegions.length - 1, 1));
  const lineY = (value: number) => 35 + ((100 - value) / 50) * 390;
  const linePoints = (measure: LiteracyMetric) => chartRegions.map((region, index) => `${lineX(index)},${lineY(rate(region, measure, sex))}`).join(" ");

  return <main className="flemms" id="top">
    <header className="flemms-nav">
      <a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a>
      <nav aria-label="Dashboard sections"><a href="#literacy">Literacy</a><a href="#regions">Regions</a><a href="#ages">Age</a><a href="#digital">Digital lives</a><a href="#source">About</a></nav>
    </header>

    <section className="flemms-hero" id="literacy">
      <div className="flemms-title"><p className="dash-kicker">Education · FLEMMS 2024</p><h1>Reading,<br />reasoning &amp;<br /><em>reaching.</em></h1><p className="hero-summary">Literacy is more than reading words. Explore who can understand, compute, and navigate an increasingly digital Philippines.</p><p className="hero-framework">The Philippine Statistics Authority measures literacy at two levels. <b>Basic literacy</b> covers foundational skills for reading and writing a simple message with understanding and doing basic math. <b>Functional literacy</b> builds on those skills with higher-level comprehension.</p></div>
      <div className="flemms-hero-guide" aria-label="Definitions of the two FLEMMS literacy measures">
        <span>Start here · Two measures</span>
        <article className="basic"><div><h2>Basic literacy</h2><strong>{pct(national.basic)}</strong></div><div className="literacy-formula compact" aria-label="Read and write a simple message with understanding plus perform basic math"><span><i aria-hidden="true">Aa</i><b>Read and write a simple message with understanding</b></span><em>+</em><span><i aria-hidden="true">±</i><b>Perform basic math</b></span></div></article>
        <article className="functional"><div><h2>Functional literacy</h2><strong>{pct(national.functional)}</strong></div><div className="literacy-formula functional-formula" aria-label="Basic literacy plus integrate information plus make inferences"><span className="foundation"><i aria-hidden="true">Aa</i><b>Basic literacy</b></span><em>+</em><span><i aria-hidden="true">⇄</i><b>Integrate information</b></span><em>+</em><span><i aria-hidden="true">∴</i><b>Make inferences</b></span></div></article>
        <aside><b>Why are they {pts(gap)} percentage points apart?</b><p>Functional literacy uses a more demanding standard, so fewer people meet it. The {pts(gap)}-point difference is simply {pct(national.basic)} minus {pct(national.functional)}—not a third literacy measure.</p></aside>
      </div>
    </section>

    <aside className="flemms-orientation" aria-labelledby="complete-flemms-title">
      <div><p className="dash-kicker">About this dashboard</p><h2 id="complete-flemms-title">The broader FLEMMS view</h2><p>This dashboard brings together selected literacy, internet-use, and mass-media findings. Explore these results here, or go directly to the focused media and digital view.</p></div>
      <a href="/dashboards/flemms-mass-media"><span>Technology &amp; Digital</span><strong>Explore media and information access →</strong></a>
    </aside>

    <section className="flemms-regions" id="regions">
      <div className="flemms-section-head"><div><p className="dash-kicker">Regional literacy explorer</p><h2>The measures vary<br />across the country.</h2></div><p>Choose Basic or Functional literacy, then rank regions by that measure. Select a region for its value and female–male comparison.</p></div>
      <div className="flemms-controls"><div aria-label="Literacy measure">{(["functional", "basic"] as LiteracyMetric[]).map((item) => <button key={item} className={metric === item ? "active" : ""} onClick={() => setMetric(item)}>{item} literacy</button>)}</div><div aria-label="Sex">{(["all", "female", "male"] as Sex[]).map((item) => <button key={item} className={sex === item ? `active ${item}` : item} style={sex === item ? { backgroundColor: item === "female" ? "#b94e57" : item === "male" ? "#173f67" : "#19251f" } : undefined} onClick={() => setSex(item)}>{item === "all" ? "Both sexes" : item}</button>)}</div></div>
      <div className="active-map-view" aria-live="polite"><span><i style={{ backgroundColor: activeColor }} />Showing</span><strong>{metric === "basic" ? "Basic literacy" : "Functional literacy"}</strong><em>· {sexLabel}</em></div>
      <div className="flemms-region-grid">
        <div className="flemms-map mapbox-map" aria-label={`Map of ${metric} literacy by region`}>
          <MapboxChoropleth ariaLabel={`${metric} literacy map, ${sex}`} features={mapboxFeatures} selectedId={selectedRegion?.name ?? ""} onHover={(item) => setHoveredRegion(item ? regionByName.get(item.label) ?? null : null)} onSelect={(id) => { const region = regionByName.get(id); if (region) setSelectedRegion(region); }} onClear={() => setSelectedRegion(null)} />
          {mapTooltipRegion && <div className="flemms-map-tooltip" style={{ backgroundColor: sex === "all" ? "#19251f" : activeColor }}><span>{hoveredRegion ? "Region" : "Selected region"}</span><strong>{shortName(mapTooltipRegion.name)}</strong><b>{pct(rate(mapTooltipRegion, metric, sex))}</b><small>{sexLabel} · {metric} literacy</small></div>}
          <div className="flemms-map-legend" aria-label="Literacy rate color ranges"><strong>{metric === "basic" ? "Basic" : "Functional"} literacy rate</strong><div>{legendBands.map((band, index) => <span key={band.min}><i style={{ background: `color-mix(in srgb, ${activeColor} ${Math.round(band.opacity * 100)}%, #f7f4eb)` }} /><b>{band.min}–{index === legendBands.length - 1 ? band.max : band.max - .1}%</b></span>)}</div></div>
        </div>
        <aside className="flemms-region-detail">{selectedRegion ? <><button onClick={() => setSelectedRegion(null)}>← Clear selection</button><p className="dash-kicker">Selected region</p><h3>{selectedRegion.name}</h3><div className="region-gap-number active-rate"><span>{metric === "basic" ? "Basic literacy" : "Functional literacy"} · {sexLabel}</span><strong style={{ color: activeColor }}>{pct(rate(selectedRegion, metric, sex))}</strong><small>This is the measure shown on the map and ranking.</small></div><div className="gender-gap"><span>{metric === "basic" ? "Basic" : "Functional"} literacy by sex</span><p><b>Female {pct(rate(selectedRegion, metric, "female"))}</b><b>Male {pct(rate(selectedRegion, metric, "male"))}</b></p><small>Women lead by {pts(rate(selectedRegion, metric, "female") - rate(selectedRegion, metric, "male"))} percentage points.</small></div></> : <div className="nationwide-detail"><p className="dash-kicker">Nationwide</p><h3>Philippines</h3><div className="region-gap-number active-rate"><span>{metric === "basic" ? "Basic literacy" : "Functional literacy"} · {sexLabel}</span><strong style={{ color: activeColor }}>{pct(rate(national, metric, sex))}</strong><small>National rate for Filipinos ages 10–64.</small></div><div className="gender-gap"><span>{metric === "basic" ? "Basic" : "Functional"} literacy by sex</span><p><b>Female {pct(rate(national, metric, "female"))}</b><b>Male {pct(rate(national, metric, "male"))}</b></p><small>Women lead by {pts(rate(national, metric, "female") - rate(national, metric, "male"))} percentage points nationwide.</small></div></div>}</aside>
        <div className="flemms-ranking" aria-label={`Regions ranked by ${metric} literacy`}>
          {ranked.map((region, index) => { const value = rate(region, metric, sex); return <button key={region.name} className={selectedRegion?.name === region.name ? "selected" : ""} style={selectedRegion?.name === region.name ? { boxShadow: `inset 3px 0 ${activeColor}` } : undefined} onClick={() => setSelectedRegion(region)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{shortName(region.name)}</strong><i><em style={{ width: `${value}%`, backgroundColor: activeColor }} /></i><b>{pct(value)}</b></button>; })}
        </div>
      </div>
    </section>

    <section className="literacy-region-lines" aria-labelledby="region-lines-title">
      <div className="region-lines-head"><div><p className="dash-kicker">Regional comparison</p><h3 id="region-lines-title">See both literacy measures<br />across every region.</h3></div><p>The green line shows basic literacy and the orange line shows functional literacy. Sort by functional literacy to see where regional differences are widest.</p></div>
      <div className="region-line-summary"><div><span>Highest functional literacy</span><strong>{shortName([...chartRegions].sort((a, b) => rate(b, "functional", sex) - rate(a, "functional", sex))[0].name)} · {pct(Math.max(...chartRegions.map((region) => rate(region, "functional", sex))))}</strong></div><div><span>Lowest functional literacy</span><strong>{shortName([...chartRegions].sort((a, b) => rate(a, "functional", sex) - rate(b, "functional", sex))[0].name)} · {pct(Math.min(...chartRegions.map((region) => rate(region, "functional", sex))))}</strong></div><div><span>Regional spread</span><strong>{pts(Math.max(...chartRegions.map((region) => rate(region, "functional", sex))) - Math.min(...chartRegions.map((region) => rate(region, "functional", sex))))} pts</strong></div></div>
      <div className="region-line-toolbar"><span>Both measures · {sexLabel}</span><div aria-label="Regional chart order">{(["sequence", "descending", "ascending"] as RegionOrder[]).map((order) => <button key={order} className={regionOrder === order ? "active" : ""} onClick={() => setRegionOrder(order)}>{order === "sequence" ? "Regional sequence" : order}</button>)}</div></div>
      <div className="region-line-scroll"><div className="region-line-chart" role="img" aria-label={`Line chart comparing basic and functional literacy across regions, ordered ${regionOrder}`}>
        <svg viewBox="0 0 1670 520" aria-hidden="true">
          {[50, 60, 70, 80, 90, 100].map((tick) => <g key={tick}><line x1="70" y1={lineY(tick)} x2="1600" y2={lineY(tick)} /><text x="55" y={lineY(tick) + 5}>{tick}%</text></g>)}
          <polyline className="basic-line" points={linePoints("basic")} /><polyline className="functional-line" points={linePoints("functional")} />
          {chartRegions.map((region, index) => <g key={region.name}><circle className="basic-dot" cx={lineX(index)} cy={lineY(rate(region, "basic", sex))} r="4" /><circle className="functional-dot" cx={lineX(index)} cy={lineY(rate(region, "functional", sex))} r="4" /></g>)}
        </svg>
        <div className="region-line-labels">{chartRegions.map((region) => <span key={region.name}>{shortName(region.name)}</span>)}</div>
      </div></div>
      <div className="flemms-key region-line-key"><span><i className="basic" />Basic literacy</span><span><i className="functional" />Functional literacy</span></div>
    </section>

    <section className="flemms-ages" id="ages">
      <div className="flemms-section-head"><div><p className="dash-kicker">Literacy across the life course</p><h2>Functional literacy is highest<br />among ages 20–24.</h2></div><div className="age-sex-tabs">{(["all", "female", "male"] as Sex[]).map((item) => <button key={item} className={ageSex === item ? "active" : ""} onClick={() => setAgeSex(item)}>{item === "all" ? "Both sexes" : item}</button>)}</div></div>
      <div className="age-chart-explainer"><p>Each age group has a <b>green Basic literacy bar</b> and an <b>orange Functional literacy bar</b>. The distance between their tops shows how far apart the two rates are.</p><div className="flemms-key"><span><i className="basic" />Basic literacy</span><span><i className="functional" />Functional literacy</span></div></div>
      <div className="age-chart" role="img" aria-label={`Paired bars showing basic and functional literacy by age group, ${ageSex}`}>
        {data.ages.map((age) => { const basic = rate(age as LiteracyRecord, "basic", ageSex); const functional = rate(age as LiteracyRecord, "functional", ageSex); return <div className="age-column" key={age.name}><div className="age-bars"><i className="basic" style={{ height: `${basic}%` }}><span>{pct(basic)}</span></i><i className="functional" style={{ height: `${functional}%` }}><span>{pct(functional)}</span></i></div><strong>{age.name}</strong><small>{pts(basic - functional)} pts apart</small></div>; })}
      </div>
    </section>

    <section className="flemms-reading-platforms" id="reading-platforms" aria-labelledby="reading-platforms-title">
      <div className="flemms-reading-head">
        <div><p className="dash-kicker">Reading and information platforms</p><h2 id="reading-platforms-title">Print and digital,<br />side by side.</h2></div>
        <div><p>Compare exposure to four published reading platforms among people ages 10–64. Select the Philippines or an official FLEMMS region.</p><label><span>Select a geography</span><select value={readingPlace} onChange={(event) => setReadingPlace(event.target.value)}>{readingOptions.map((item) => <option key={item.name}>{item.name}</option>)}</select></label></div>
      </div>
      <p className="flemms-viz-meta reading-meta"><b>Source:</b> Philippine Statistics Authority, 2024 FLEMMS · <b>Table 2a</b> · Population ages 10–64 · Reference year 2024 · Philippines and 18 FLEMMS regions · Multiple reading platforms may apply; percentages are not additive.</p>
      <div className="flemms-reading-grid">
        {(Object.entries({ digitalNewspaper: "Newspaper (online/digital)", printMagazine: "Magazine (printed)", printPosters: "Posters (printed)", printNewspaper: "Newspaper (printed)" }) as [keyof Omit<ReadingRecord, "name">, string][]).map(([key, label]) => <article key={key}><span>{label}</span><strong>{pct(selectedReading[key])}</strong><i><em style={{ width: `${selectedReading[key]}%` }} /></i></article>)}
      </div>
    </section>

    <section className="flemms-digital" id="digital">
      <aside className="flemms-digital-companion"><div><strong>Want a media-focused view?</strong><p>Explore the same FLEMMS internet-purpose and mass-media findings in the focused Technology &amp; Digital dashboard.</p></div><a href="/dashboards/flemms-mass-media">Explore media and information access →</a></aside>
      <div className="flemms-section-head"><div><p className="dash-kicker">Digital lives</p><h2>Online—but<br />for what?</h2></div><p>Share of people ages 10–64 who used the internet for each purpose. Choose a region or age group to see how purposes differ.</p></div>
      <p className="flemms-viz-meta"><b>Source:</b> Philippine Statistics Authority, 2024 FLEMMS · <b>Table 2c</b> · Population ages 10–64 · Reference year 2024 · Philippines, 18 FLEMMS regions, and age groups · Multiple purposes may apply; percentages are not additive.</p>
      <div className="media-filter"><div><span>Compare internet use</span><div className="media-filter-tabs" aria-label="Comparison group"><button className={mediaGroup === "region" ? "active" : ""} onClick={() => { setMediaGroup("region"); setMediaPlace("Philippines"); }}>By region</button><button className={mediaGroup === "age" ? "active" : ""} onClick={() => { setMediaGroup("age"); setMediaPlace("10-14"); }}>By age</button></div></div><label><span>{mediaGroup === "region" ? "Select a region" : "Select an age group"}</span><select value={mediaPlace} onChange={(event) => setMediaPlace(event.target.value)}>{mediaOptions.map((item) => <option key={item.name}>{item.name}</option>)}</select></label></div>
      <div className="internet-grid">{(Object.keys(internetLabels) as (keyof typeof internetLabels)[]).map((key, index) => <article key={key}><span>0{index + 1}</span><strong>{pct(media[key])}</strong><h3>{internetLabels[key]}</h3><div><i style={{ width: `${media[key]}%` }} /></div></article>)}</div>
      <section className="media-comparison" aria-labelledby="media-comparison-title">
        <div className="media-comparison-head"><div><p className="dash-kicker">Across {mediaGroup === "region" ? "regions" : "age groups"}</p><h3 id="media-comparison-title">How internet use differs.</h3></div><p>Follow each line to compare why people go online. Use the filter above to switch between regional and age-group patterns.</p></div>
        <div className="media-line-key">{internetSeries.map((series) => <span key={series.key}><i className={series.className} />{series.label}</span>)}</div>
        <div className="media-line-scroll"><div className={`media-line-chart ${mediaGroup}`} role="group" aria-label={`Interactive line chart comparing four purposes of internet use by ${mediaGroup}`}>
          <svg viewBox="0 0 1670 410">
            {[0, 20, 40, 60, 80, 100].map((tick) => <g key={tick}><line x1="75" y1={mediaLineY(tick)} x2="1585" y2={mediaLineY(tick)} /><text x="58" y={mediaLineY(tick) + 5}>{tick}%</text></g>)}
            {internetSeries.map((series) => <g className={`media-series ${series.className}`} key={series.key}><polyline points={mediaLinePoints(series.key)} />{mediaComparison.map((item, index) => <circle key={item.name} cx={mediaLineX(index)} cy={mediaLineY(item[series.key])} r="4" tabIndex={0} role="button" aria-label={`${shortName(item.name)}, ${series.label}: ${pct(item[series.key])}`} onMouseEnter={() => setMediaPoint((current) => current?.mode === "click" ? current : { name: shortName(item.name), label: series.label, value: item[series.key], x: mediaLineX(index), y: mediaLineY(item[series.key]), className: series.className, mode: "hover" })} onMouseLeave={() => setMediaPoint((current) => current?.mode === "hover" ? null : current)} onFocus={() => showMediaPoint(item, index, series.key, series.label, series.className, "hover")} onBlur={() => setMediaPoint((current) => current?.mode === "hover" ? null : current)} onClick={(event) => { event.stopPropagation(); showMediaPoint(item, index, series.key, series.label, series.className, "click"); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); showMediaPoint(item, index, series.key, series.label, series.className, "click"); } }} />)}</g>)}
          </svg>
          {mediaPoint && <div className={`media-line-tooltip ${mediaPoint.className}`} style={{ left: `${Math.max(7, Math.min(93, mediaPoint.x / 16.7))}%`, top: `${mediaPoint.y / 4.1}%` }}><span>{mediaPoint.name}</span><strong>{pct(mediaPoint.value)}</strong><small>{mediaPoint.label}</small></div>}
          <div className="media-line-labels" style={{ gridTemplateColumns: `repeat(${mediaComparison.length}, minmax(0, 1fr))` }}>{mediaComparison.map((item) => <span key={item.name}>{shortName(item.name)}</span>)}</div>
        </div></div>
      </section>
      <p className="flemms-viz-meta dark"><b>Source:</b> Philippine Statistics Authority, 2024 FLEMMS · <b>Table 2b</b> · Population ages 10–64 · Reference year 2024 · Philippines · Multiple media platforms may apply; percentages are not additive.</p>
      <div className="media-context"><div><p className="dash-kicker">National platform exposure</p><h3>Television leads, with streaming close behind.</h3></div>{(data.audioVisual[0] ? Object.entries({ television: "Television", videoStreaming: "Video streaming", musicStreaming: "Music streaming", radio: "Radio" }) : []).map(([key, label]) => <section key={key}><span>{label}</span><i><em style={{ width: `${(data.audioVisual[0] as Record<string, number | string>)[key]}%` }} /></i><b>{pct((data.audioVisual[0] as Record<string, number | string>)[key] as number)}</b></section>)}</div>
    </section>

    <section className="flemms-change">
      <div><p className="dash-kicker">2019 → 2024</p><h2>A changing<br />media diet.</h2><p>Comparable measures show large declines in exposure to traditional television, radio, and printed media. New digital measures appear only in 2024 and are marked accordingly.</p></div>
      <p className="flemms-viz-meta change-meta"><b>Source:</b> Philippine Statistics Authority, 2019 and 2024 FLEMMS · <b>Table 1</b> · Population ages 10–64 · Philippines · Reference years 2019 and 2024 · Multiple media forms may apply; percentages are not additive.</p>
      <div className="media-slope-wrap" onClick={() => setSlopePoint(null)}><div className="media-slope-key"><span><i className="down" />Decrease</span><span><i className="up" />Increase</span></div><div className="media-slope-scroll"><svg className="media-slope" viewBox="0 0 1450 700" role="img" aria-label="Slopegraph comparing mass-media exposure in 2019 and 2024"><text className="slope-year" x="430" y="36">2019</text><text className="slope-year" x="1020" y="36">2024</text><line className="slope-axis" x1="430" y1="52" x2="430" y2="640" /><line className="slope-axis" x1="1020" y1="52" x2="1020" y2="640" />{slopeTrends.map((item) => { const start = item["2019"] as number; const end = item["2024"]; const direction: "up" | "down" = end >= start ? "up" : "down"; const leftLabelY = slopeLabels2019.get(item.name) ?? slopeY(start); const rightLabelY = slopeLabels2024.get(item.name) ?? slopeY(end); const point = { name: trendShortName(item.name), start, end, y: (slopeY(start) + slopeY(end)) / 2, direction }; return <g className={`slope-item ${direction}`} key={item.name} tabIndex={0} role="button" aria-label={`${point.name}: ${pct(start)} in 2019, ${pct(end)} in 2024, ${(end - start).toFixed(1)} percentage points`} onMouseEnter={() => setSlopePoint((current) => current?.mode === "click" ? current : { ...point, mode: "hover" })} onMouseLeave={() => setSlopePoint((current) => current?.mode === "hover" ? null : current)} onFocus={() => setSlopePoint({ ...point, mode: "hover" })} onBlur={() => setSlopePoint((current) => current?.mode === "hover" ? null : current)} onClick={(event) => { event.stopPropagation(); setSlopePoint({ ...point, mode: "click" }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); setSlopePoint({ ...point, mode: "click" }); } }}><line className="slope-hit" x1="430" y1={slopeY(start)} x2="1020" y2={slopeY(end)} /><line className="slope-connector" x1="430" y1={slopeY(start)} x2="1020" y2={slopeY(end)} /><circle cx="430" cy={slopeY(start)} r="5" /><circle cx="1020" cy={slopeY(end)} r="5" /><path className="slope-leader" d={`M 406 ${slopeY(start)} H 396 V ${leftLabelY} H 385`} /><path className="slope-leader" d={`M 1044 ${slopeY(end)} H 1054 V ${rightLabelY} H 1065`} /><text className="slope-label left" x="374" y={leftLabelY + 5}>{trendShortName(item.name)} · {pct(start)}</text><text className="slope-label right" x="1076" y={rightLabelY + 5}>{pct(end)} · {trendShortName(item.name)}</text></g>; })}</svg>{slopePoint && <div className={`slope-tooltip ${slopePoint.direction}`} style={{ top: `${Math.max(16, Math.min(78, slopePoint.y / 7))}%` }}><strong>{slopePoint.name}</strong><div><span>2019<b>{pct(slopePoint.start)}</b></span><span>2024<b>{pct(slopePoint.end)}</b></span><span>Change<b>{slopePoint.end - slopePoint.start >= 0 ? "+" : ""}{(slopePoint.end - slopePoint.start).toFixed(1)} pts</b></span></div></div>}</div><div className="new-in-2024"><span>New measures in 2024</span>{newTrends.map((item) => <article key={item.name}><strong>{trendShortName(item.name)}</strong><b>{pct(item["2024"])}</b></article>)}</div></div>
    </section>

    <section className="flemms-source" id="source"><p className="dash-kicker">About the data</p><h2>Literacy, internet use,<br />and mass media.</h2><p className="flemms-complete-note">This is the complete DC Factbook view of the 2024 FLEMMS, covering literacy, internet use, and mass-media exposure.</p><div><div className="source-links"><b>Official PSA sources</b><a href="https://psa.gov.ph/content/every-10-filipinos-9-have-basic-literacy-while-7-have-functional-literacy-final-results" target="_blank" rel="noreferrer"><span>2024 literacy final results</span><em>PSA source page ↗</em></a><a href="https://psa.gov.ph/content/over-68-million-filipinos-aged-10-64-years-used-internet-social-media-2024" target="_blank" rel="noreferrer"><span>2024 mass media and internet use</span><em>PSA source page ↗</em></a><a href="https://psa.gov.ph/system/files/sdsd/2024%20FLEMMS%20Press%20Release%20Final%20Results_signed_0.pdf" target="_blank" rel="noreferrer"><span>2024 FLEMMS final-results release</span><em>PDF ↗</em></a><a href="https://psa.gov.ph/system/files/sdsd/2024%20FLEMMS%20Technical%20Notes_signed_1.pdf" target="_blank" rel="noreferrer"><span>2024 final-results technical notes</span><em>PDF ↗</em></a><a href="https://psa.gov.ph/content/functional-literacy-rate-filipinos-exposure-different-forms-mass-media-ranges-926-percent" target="_blank" rel="noreferrer"><span>2019 FLEMMS results</span><em>PSA source page ↗</em></a></div><p><b>Coverage</b>Literacy comparisons and Tables 1, 2a, 2b, and 2c cover people ages 10–64. The media tables use the Philippines and the 18 official FLEMMS regions, including the Negros Island Region. FLEMMS results are presented independently and are not joined to NICTHS records.</p><p><b>Interpretation</b>Rates are survey estimates. Reading platforms, media forms, and internet purposes may overlap, so their percentages are not additive. Newly introduced 2024 media items are not treated as zero in 2019.</p></div></section>
    <section className="flemms-history" aria-labelledby="flemms-history-title">
      <div><p className="dash-kicker" id="flemms-history-title">Dashboard history</p></div>
      <dl><div><dt>Created</dt><dd>14 August 2026</dd></div><div><dt>Updated</dt><dd>24 August 2026</dd></div><div><dt>Reviewed</dt><dd>24 August 2026</dd></div></dl>
      <button type="button" onClick={() => setHistoryOpen(true)}>View maintenance log →</button>
    </section>
    {historyOpen && <div className="flemms-history-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}><section className="flemms-history-modal" role="dialog" aria-modal="true" aria-labelledby="maintenance-log-title"><header><div><p className="dash-kicker">Dashboard history</p><h2 id="maintenance-log-title">Maintenance Log</h2></div><button type="button" aria-label="Close maintenance log" onClick={() => setHistoryOpen(false)}>×</button></header><article className="featured"><time>24 August 2026</time><h3>Cross-dashboard parity and source-note update</h3><p>Reconciled the full Education dashboard with the focused Technology &amp; Digital view using the same FLEMMS dataset. Added the Table 2a reading-platform explorer for the Philippines and 18 official regions, standardized the Table 1, 2a, 2b, and 2c metadata notes, aligned labels and slopegraph behavior, strengthened keyboard dismissal, clarified the relationship between the two views, and reviewed desktop, tablet, and mobile presentation.</p></article><div className="flemms-history-entries"><article><time>21 August 2026</time><h3>Dashboard and data QA</h3><p>Reconciled the dashboard’s literacy, internet-use, reading-platform, audiovisual, and 2019–2024 trend values with the official PSA workbooks. Corrected percentage-point notation, source versioning, literacy definitions, denominator wording, editorial claims, and mobile chart-label legibility.</p></article><article><time>21 August 2026</time><h3>Navigation and documentation review</h3><p>Improved navigation legibility and hover states, standardized the DATA badge, and added dashboard history and maintenance documentation.</p></article><article><time>20 August 2026</time><h3>Brand-system alignment</h3><p>Updated the dashboard badge to match the Factbook navigation specifications and Education color system.</p></article><article><time>18 August 2026</time><h3>Visualization and interaction update</h3><p>Added the interactive regional Mapbox view, discrete literacy-rate legend, regional comparison charts, and the accessible 2019–2024 media slopegraph.</p></article><article><time>14 August 2026</time><h3>Dashboard created</h3><p>Created the broader 2024 FLEMMS view covering selected literacy, internet-use, and mass-media findings.</p></article></div></section></div>}
    <a className="back-to-top" href="#top" aria-label="Back to top">↑</a>
    <footer className="dash-footer"><a href="/">← Back to Factbook</a><span>Education · FLEMMS 2024</span></footer>
  </main>;
}
