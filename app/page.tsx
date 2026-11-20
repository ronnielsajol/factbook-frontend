"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalogData from "../data/catalog.json";
import taxonomyData from "../data/taxonomy.json";

type Status = "published" | "in-development" | "planned" | "archived";
type Dashboard = {
  slug: string;
  title: string;
  description: string;
  thumbnail: string | null;
  thumbnailCredit?: string | null;
  thumbnailSourceUrl?: string | null;
  url: string | null;
  status: Status;
  labels?: string[];
  topics: string[];
  category: string;
  geography: string;
  period: string;
  sources: string[];
  publishedAt: string | null;
  updatedAt: string;
};

const catalog = catalogData as Dashboard[];
const taxonomy = taxonomyData as { name: string; color: string }[];
const all = "All";

function unique(field: "topics" | "category" | "geography" | "period") {
  return Array.from(new Set(catalog.flatMap((item) => field === "topics" ? item[field] : [item[field]])));
}

function formatDate(date: string | null) {
  if (!date) return "Not yet published";
  return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`));
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(all);
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  const [browseSelection, setBrowseSelection] = useState<{ type: "Category"; value: string } | null>(null);
  const selectedResultsRef = useRef<HTMLDivElement>(null);
  const maintenanceCloseRef = useRef<HTMLButtonElement>(null);

  const publishedCatalog = catalog.filter((item) => item.status === "published");
  const developmentCatalog = catalog.filter((item) => item.status === "in-development");
  const publishedCategoryCount = new Set(publishedCatalog.map((item) => item.category)).size;
  const factbookUpdatedAt = publishedCatalog.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, publishedCatalog[0]?.updatedAt ?? "");
  const latestDashboard = [...publishedCatalog].sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt))[0];
  const browseItems = taxonomy.map((item) => ({ label: item.name, color: item.color, count: publishedCatalog.filter((dashboard) => dashboard.category === item.name).length }));
  const activeBrowse = browseSelection?.value ?? all;
  const browseResults = browseSelection ? publishedCatalog.filter((item) => item.category === browseSelection.value) : [];
  const hasSearch = query.trim().length > 0 || category !== all;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return publishedCatalog.filter((item) => {
      const searchable = [item.title, item.description, item.category, item.geography, item.period, ...item.sources, ...item.topics, ...(item.labels ?? [])].join(" ").toLowerCase();
      return (!needle || searchable.includes(needle)) && (category === all || item.category === category);
    });
  }, [query, category]);

  const reset = () => { setQuery(""); setCategory(all); };
  useEffect(() => {
    if (!browseSelection) return;
    const frame = requestAnimationFrame(() => {
      selectedResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      selectedResultsRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [browseSelection]);

  useEffect(() => {
    if (!showMaintenanceLog) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMaintenanceLog(false); };
    document.addEventListener("keydown", close);
    maintenanceCloseRef.current?.focus();
    return () => document.removeEventListener("keydown", close);
  }, [showMaintenanceLog]);

  const browse = (value: string) => {
    if (browseSelection?.value === value) {
      setBrowseSelection(null);
      return;
    }
    setBrowseSelection({ type: "Category", value });
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Factbook home"><span>DATA</span><strong>Factbook</strong></a>
        <nav aria-label="Primary navigation"><a href="#browse">Browse by Category</a><a href="#search">Search</a>{developmentCatalog.length > 0 && <a href="#coming">Coming</a>}<a href="#about">About</a></nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Philippine data, made explorable</p>
          <h1>Discover insight<br />in the <em>data.</em></h1>
          <p>A searchable collection of interactive dashboards covering industries, sectors, and public-interest topics in the Philippines.</p>
          <a className="hero-action" href="#browse">Browse the Factbook <span>↓</span></a>
        </div>
        <div className="hero-mark" aria-label={`${publishedCatalog.length} published dashboards across ${publishedCategoryCount} categories. Factbook updated ${formatLongDate(factbookUpdatedAt)}.`}>
          <span>Factbook at a glance</span>
          <div className="hero-factbook-meta">
            <div><strong>{publishedCatalog.length}</strong><span>Published dashboards</span></div>
            <div><strong>{publishedCategoryCount}</strong><span>Active categories</span></div>
          </div>
          {latestDashboard && <div className="hero-latest">
            <small>Latest addition</small>
            <a href={latestDashboard.url ?? "#browse"}><strong>{latestDashboard.title}</strong><b aria-hidden="true">↗</b></a>
            <span>{latestDashboard.category}</span>
          </div>}
          <small className="hero-updated">Factbook last updated {formatLongDate(factbookUpdatedAt)}</small>
        </div>
      </section>

      <aside className="viewing-note" aria-label="Viewing note">
        <strong>Best viewed on a larger screen.</strong>
        <span>The Factbook remains accessible on mobile, but detailed maps and controls are easier to explore on desktop.</span>
      </aside>

      <section className="browse-section" id="browse">
        <div className="browse-heading">
          <div><p className="eyebrow">Explore the collection</p><h2>Browse the Factbook</h2></div>
        </div>
        <div className="browse-list">
          {browseItems.map((item, index) => <button className={activeBrowse === item.label ? "selected" : ""} aria-pressed={activeBrowse === item.label} key={item.label} disabled={!item.count} onClick={() => browse(item.label)}><span><i style={{ background: item.color }} />{String(index + 1).padStart(2, "0")}</span><strong>{item.label}</strong><small>{item.count ? `${item.count} ${item.count === 1 ? "dashboard" : "dashboards"}` : "Future coverage"}</small><b>{activeBrowse === item.label ? "" : item.count ? "→" : ""}</b></button>)}
        </div>
      </section>

      <section className="catalog-section" id="catalog">
        {browseSelection && <div className="selected-results" ref={selectedResultsRef} tabIndex={-1}>
          <div className="section-heading">
            <div><p className="eyebrow">Selected {browseSelection.type}</p><h2>{browseSelection.value}</h2></div>
            <p>{browseResults.length} {browseResults.length === 1 ? "dashboard" : "dashboards"} currently available in this area.</p>
          </div>
          <div className="active-filter" aria-live="polite"><div><span>Browsing by {browseSelection.type}</span><strong>{browseSelection.value}</strong><small>{browseResults.length} {browseResults.length === 1 ? "dashboard" : "dashboards"}</small></div><button onClick={() => setBrowseSelection(null)}>Clear selection</button></div>
          <div className="card-grid browse-results">{browseResults.map((item) => <DashboardCard dashboard={item} key={`browse-${item.slug}`} />)}</div>
        </div>}

        <div className={`section-heading search-heading ${browseSelection ? "after-results" : ""}`} id="search">
          <div><p className="eyebrow">Dashboard directory</p><h2>Search</h2></div>
          <p>Search by keyword or source, or narrow the collection by category.</p>
        </div>

        <div className="discovery" role="search" onFocusCapture={() => setBrowseSelection(null)}>
          <div className="filters">
            <Filter label="Category" value={category} values={unique("category")} onChange={setCategory} />
          </div>
          <label className="search-box"><span>Keyword or source</span><div><b aria-hidden="true">⌕</b><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “internet”, “PSA”, or “regional”…" /></div></label>
        </div>

        {hasSearch && <>
          <div className="results-bar" aria-live="polite"><span><strong>{filtered.length}</strong> {filtered.length === 1 ? "result" : "results"}</span><button onClick={reset}>Clear search</button></div>
          {filtered.length ? <div className="card-grid">{filtered.map((item) => <DashboardCard dashboard={item} key={item.slug} />)}</div> : <div className="empty-state"><strong>No dashboards match those filters.</strong><p>Try a broader keyword or clear the filters.</p><button onClick={reset}>Reset search</button></div>}
        </>}
      </section>

      {developmentCatalog.length > 0 && <section className="coming-section" id="coming">
        <div className="coming-heading">
          <div><p className="eyebrow">In development</p><h2>Coming to the Factbook</h2></div>
          <p>Dashboards currently being prepared for publication.</p>
        </div>
        <div className="coming-list">
          {developmentCatalog.map((item, index) => <article key={item.slug}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><small>{item.category}</small><h3>{item.title}</h3><p>{item.description}</p></div>
            <dl><div><dt>Coverage</dt><dd>{item.geography}</dd></div><div><dt>Reference period</dt><dd>{item.period}</dd></div></dl>
            <strong>In development</strong>
          </article>)}
        </div>
      </section>}

      <section className="about" id="about">
        <div className="about-intro"><p>This Factbook is a catalog of interactive data dashboards and maps covering key sectors, industries, and public-interest topics in the Philippines.</p></div>
        <div className="about-notes">
          <article className="about-editorial"><h3>Editorial note</h3><p>The Factbook is independently managed and maintained by one person. Each dashboard is reviewed and developed using official sources wherever available, with care taken to ensure that the information is accurate and clearly presented.</p></article>
          <article><h3>Corrections and feedback</h3><p>If something appears incorrect or incomplete, please share it with your usual Factbook contact so it can be reviewed.</p></article>
        </div>
        <div className="factbook-history"><div><span>Homepage maintenance</span><strong>Factbook last updated {formatLongDate(factbookUpdatedAt)}</strong></div><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log <span aria-hidden="true">→</span></button></div>
      </section>
      {showMaintenanceLog && <div className="factbook-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}>
        <section className="factbook-maintenance-log" role="dialog" aria-modal="true" aria-labelledby="factbook-maintenance-title">
          <header><div><p>Homepage history</p><h2 id="factbook-maintenance-title">Maintenance Log</h2></div><button ref={maintenanceCloseRef} type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header>
          <div className="factbook-log-note"><strong>About this log</strong><p>This records maintenance activity for the Factbook homepage and collection directory. Maintenance logs for individual dashboards are available in each dashboard’s About section.</p></div>
          <div className="factbook-log-entries">
            <article><time dateTime="2026-09-11">11 September 2026</time><h3>Education catalog updated</h3><p>Added the School Infrastructure dashboard to Education with a source-linked Philippine Information Agency thumbnail, maps of internet, water and electricity gaps, facility summaries and a searchable school list using DepEd school-year 2023–2024 records. Clarified the Higher Education Institutions reference period as Academic Year 2024–2025, using source data as of 15 May 2025.</p></article>
            <article><time dateTime="2026-09-09">9 September 2026</time><h3>DPWH Infrastructure Projects added</h3><p>Added the published DPWH Infrastructure Projects dashboard to the collection catalog with a source-linked DPWH thumbnail. Activated the Infrastructure category and refreshed the homepage dashboard count, latest addition, and Factbook update date.</p></article>
            <article><time dateTime="2026-08-28">28 August 2026</time><h3>Electorate catalog and scalable card layout</h3><p>Added the 2022 Philippine Electorate and 2022 National and Local Elections to the collection, standardized their titles, and assigned new source-linked thumbnail images. Updated category results to show three cards per row on large screens, two on medium screens, and one on mobile so the growing collection remains easier to scan.</p></article>
            <article><time dateTime="2026-08-27">27 August 2026</time><h3>Cloudflare deployment and access protection</h3><p>Deployed the Factbook from the local project to Cloudflare Workers at factbook.583104.workers.dev. Added a PIN access page and signed session protection. The Cloudflare deployment and the original ChatGPT Sites deployment remain separate copies and are updated independently.</p></article>
            <article><time dateTime="2026-08-27">27 August 2026</time><h3>Homepage navigation and collection update</h3><p>Added the 2025 National and Local Elections dashboard, refined the navigation labels, improved small-text legibility, introduced a more useful Factbook summary, and added viewing, editorial, and corrections notes.</p></article>
            <article><time dateTime="2026-08-25">25 August 2026</time><h3>Discovery and accessibility improvements</h3><p>Made dashboard thumbnails clickable, added persistent navigation, added Search and Coming sections to the navigation, and expanded the catalog with the language dashboards.</p></article>
            <article><time dateTime="2026-08-20">20 August 2026</time><h3>Paired-dataset labeling</h3><p>Introduced the Paired datasets label for dashboards that bring related datasets together for exploratory comparison.</p></article>
            <article><time dateTime="2026-08-12">12 August 2026</time><h3>Factbook homepage created</h3><p>Created the shared catalog, category browsing, search, dashboard metadata cards, and responsive homepage structure.</p></article>
          </div>
        </section>
      </div>}
      <footer><a className="brand" href="#top"><span>DATA</span><strong>Factbook</strong></a><p>Philippine data, made explorable.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  );
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}><option>{all}</option>{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function DashboardCard({ dashboard: d }: { dashboard: Dashboard }) {
  const published = d.status === "published" && d.url;
  const media = d.thumbnail ? <img src={d.thumbnail} alt={`Editorial preview for ${d.title}`} /> : <div className="placeholder-art"><span>Factbook</span><b>{d.topics[0]}</b><i>{published ? "Interactive dashboard" : "Concept preview"}</i></div>;
  const external = Boolean(d.url && !d.url.startsWith("/"));
  return <article className={`dashboard-card ${published ? "published" : "unpublished"}`}>
    <div className="thumbnail">
      {published ? <a className="thumbnail-link" href={d.url!} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} aria-label={`Open ${d.title}`}>{media}</a> : media}
      {d.labels?.includes("paired-datasets") && <span className="paired-dataset-label">Paired datasets</span>}
      {d.thumbnailCredit && <small className="photo-credit">Image: {d.thumbnailSourceUrl ? <a href={d.thumbnailSourceUrl} target="_blank" rel="noreferrer">{d.thumbnailCredit}</a> : d.thumbnailCredit}</small>}
    </div>
    <div className="card-body">
      <div className="classification"><span className="category-tag" style={{ borderColor: taxonomy.find((item) => item.name === d.category)?.color }}>{d.category}</span><div className="tags">{d.topics.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
      <h3>{d.title}</h3>
      <p className="description">{d.description}</p>
      <dl><div><dt>Geography</dt><dd>{d.geography}</dd></div><div><dt>Reference period</dt><dd>{d.period}</dd></div><div><dt>Primary sources</dt><dd>{d.sources.join(" · ")}</dd></div><div><dt>Last updated</dt><dd>{formatDate(d.updatedAt)}</dd></div></dl>
      {published ? <a className="open-action" href={d.url!} target={d.url!.startsWith("/") ? undefined : "_blank"} rel={d.url!.startsWith("/") ? undefined : "noreferrer"}><span>Open dashboard</span><b>↗</b></a> : <div className="not-live"><span>Not a published product</span><small>Catalog demonstration only</small></div>}
    </div>
  </article>;
}
