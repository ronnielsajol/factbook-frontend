"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForeignServiceMap, { type ForeignPost } from "./ForeignServiceMap";
import directory from "../../../data/generated/dfa-foreign-service-posts-2026.json";

const allPosts = directory.posts as ForeignPost[];
const types = ["All posts", "Embassies", "Consulates general", "Permanent missions"] as const;
type Filter = typeof types[number];

const matchesType = (post: ForeignPost, filter: Filter) => filter === "All posts" || (filter === "Embassies" && post.type === "Embassy") || (filter === "Consulates general" && post.type === "Consulate General") || (filter === "Permanent missions" && post.type.startsWith("Permanent Mission"));
const shortType = (type: string) => type === "Embassy" || type === "Consulate General" ? type : "Permanent Mission";

function ContactLine({ line }: { line: string }) {
  const pattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const parts = line.split(pattern);
  return <>{parts.map((part, index) => {
    if (!part) return null;
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) return <a key={index} href={`mailto:${part}`}>{part}</a>;
    if (/^(https?:\/\/|www\.)/i.test(part)) return <a key={index} href={part.startsWith("www.") ? `https://${part}` : part} target="_blank" rel="noreferrer">{part}</a>;
    return <span key={index}>{part}</span>;
  })}</>;
}

export default function ForeignServicePosts2026() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All posts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return allPosts.filter((post) => matchesType(post, filter) && (!needle || `${post.city} ${post.country} ${post.type}`.toLocaleLowerCase().includes(needle)));
  }, [query, filter]);
  const selected = visible.find((post) => post.id === selectedId) ?? null;
  const colocated = selected ? allPosts.filter((post) => post.city === selected.city && post.country === selected.country) : [];

  useEffect(() => {
    if (!showMaintenanceLog) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setShowMaintenanceLog(false); };
    window.addEventListener("keydown", close);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", close);
  }, [showMaintenanceLog]);

  return <main className="fsp-page" id="top">
    <header className="fsp-nav"><a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a><nav aria-label="Dashboard sections"><a href="#overview">Overview</a><a href="#map">Explore the map</a><a href="#source">About</a></nav></header>

    <header className="fsp-hero" id="overview">
      <div><p className="fsp-kicker">Migration &amp; Foreign Affairs</p><h1>Philippine Foreign<br />Service Posts</h1><p className="fsp-as-of">As of July 20, 2026</p><p className="fsp-deck">Explore the country’s network of embassies, consulates general, and permanent missions as listed by the Department of Foreign Affairs.</p></div>
      <div className="fsp-total"><span>Foreign service network</span><strong>102</strong><small>posts in 99 cities</small><dl><div><dt>Embassies</dt><dd>68</dd></div><div><dt>Consulates general</dt><dd>30</dd></div><div><dt>Permanent missions</dt><dd>4</dd></div></dl></div>
    </header>

    <section className="fsp-explorer" id="map">
      <aside className="fsp-controls">
        <div><p className="fsp-kicker">Find a post</p><h2>Explore the network</h2></div>
        <label className="fsp-search"><span>Search city or country</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} placeholder="e.g. Tokyo or Canada" /></label>
        <div className="fsp-filters" aria-label="Filter by post type">{types.map((item) => <button key={item} className={filter === item ? "active" : ""} aria-pressed={filter === item} onClick={() => { setFilter(item); setSelectedId(null); }}><span>{item !== "All posts" && <i data-type={item === "Embassies" ? "Embassy" : item === "Consulates general" ? "Consulate General" : "Permanent Mission"} />}{item}</span><b>{item === "All posts" ? 102 : item === "Embassies" ? 68 : item === "Consulates general" ? 30 : 4}</b></button>)}</div>
        <p className="fsp-results">{visible.length} matching post{visible.length === 1 ? "" : "s"}</p>
        <div className="fsp-list">{visible.map((post) => <button key={post.id} className={selectedId === post.id ? "selected" : ""} aria-pressed={selectedId === post.id} onClick={() => setSelectedId(selectedId === post.id ? null : post.id)}><i data-type={shortType(post.type)} /><span><strong>{post.city}</strong><small>{post.country} · {shortType(post.type)}</small></span></button>)}</div>
      </aside>

      <div className="fsp-map-panel">
        <ForeignServiceMap posts={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <aside className="fsp-detail" aria-live="polite">
        {selected && <button className="fsp-clear-selection" type="button" onClick={() => setSelectedId(null)}>Clear selection</button>}
        {selected ? <><p className="fsp-kicker">Selected post</p><h2>{selected.city}</h2><p className="fsp-country">{selected.country}</p>{colocated.length > 1 && <p className="fsp-colocated">{colocated.length} posts share this city. Select either entry in the directory to switch records.</p>}<div className="fsp-directory-record"><div className="fsp-post-type"><i data-type={shortType(selected.type)} /><span><strong>{selected.type}</strong><small>DFA directory record · July 20, 2026</small></span></div><section><b>Head of post</b><h3>{selected.headOfPost}</h3><p>{selected.headTitle}</p></section><section><b>Office address</b>{selected.addressLines.length ? <address>{selected.addressLines.map((line) => <span key={line}>{line}</span>)}</address> : <p className="fsp-unavailable">No office address is stated for this entry in the directory.</p>}</section><section><b>Contact details</b>{selected.contactLines.length ? <div className="fsp-contact-lines">{selected.contactLines.map((line, index) => <p key={`${line}-${index}`}><ContactLine line={line} /></p>)}</div> : <p className="fsp-unavailable">No contact details are stated for this entry in the directory.</p>}</section></div><dl><div><dt>Coordinates shown</dt><dd>{Math.abs(selected.latitude).toFixed(2)}°{selected.latitude >= 0 ? "N" : "S"}, {Math.abs(selected.longitude).toFixed(2)}°{selected.longitude >= 0 ? "E" : "W"}</dd></div><div><dt>Map precision</dt><dd>Representative city location</dd></div></dl></> : <><p className="fsp-kicker">Map guide</p><h2>Select a post</h2><p>Choose a marker or a city from the directory to inspect its leadership, address, telephone numbers, email addresses, website, and other listed contact details.</p><div className="fsp-detail-note"><strong>Directory snapshot</strong><span>Contact and officeholder information reflects the DFA document dated July 20, 2026.</span></div></>}
      </aside>
    </section>

    <section className="fsp-source" id="source"><div className="fsp-source-intro"><div><p className="fsp-kicker">About the data</p><h2>Sources, methods<br />&amp; history.</h2></div><p>The map transcribes the DFA Foreign Service Post Directory dated July 20, 2026 and places each listed post at a representative city coordinate.</p></div><div className="fsp-source-grid">
      <article><b>Primary source</b><a href="https://dfa.gov.ph/directory/" target="_blank" rel="noreferrer">DFA Directory ↗</a><p>Department of Foreign Affairs, <em>Foreign Service Post Directory</em>, as of July 20, 2026.</p></article>
      <article><b>Coordinate source</b><a href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/" target="_blank" rel="noreferrer">Natural Earth populated places ↗</a><p>City coordinates are drawn from the 1:10 million populated-places dataset.</p></article>
      <article><b>Coverage</b><p>102 posts: 68 embassies, 30 consulates general, and four permanent missions across 99 cities.</p></article>
      <article><b>Reference period</b><p>Officeholders, addresses, telephone numbers, email addresses, websites, and social links reflect the DFA directory dated July 20, 2026.</p></article>
      <article className="fsp-source-method"><b>How to read the map</b><p>Markers indicate the host city of each post; the selected-post panel reproduces its directory details. Markers do not encode exact street coordinates, diplomatic accreditation, or consular jurisdiction. Co-located posts in Jakarta, Geneva, and New York are separate directory records.</p></article>
      <article className="fsp-source-history"><div><b>Dashboard history</b><dl><div><dt>Created</dt><dd>28 August 2026</dd></div><div><dt>Last updated</dt><dd>28 August 2026</dd></div><div><dt>Last reviewed</dt><dd>28 August 2026</dd></div></dl></div><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log</button></article>
    </div></section>

    {showMaintenanceLog && <div className="fsp-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}><section className="fsp-maintenance-log" role="dialog" aria-modal="true" aria-labelledby="fsp-maintenance-title"><header><div><p className="fsp-kicker">Dashboard history</p><h2 id="fsp-maintenance-title">Maintenance Log</h2></div><button ref={closeRef} type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header><div className="fsp-log-entries"><article className="featured"><time dateTime="2026-08-28">28 August 2026</time><h3>Source and reliability QA completed</h3><p>Reconciled 1,187 transcribed title and detail strings across all 102 records with the 33-page DFA source, validated record counts, identifiers, coordinates, emails, and website formats, and corrected the field grouping of the Vienna head-of-post title.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>Full post details added</h3><p>Expanded all 102 records with the head of post, official title, address, telephone and hotline numbers, email addresses, websites, and social links stated in the DFA directory.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>Directory transcribed and reviewed</h3><p>Reconciled 102 posts from the DFA directory dated 20 July 2026, including co-located permanent missions in Jakarta, Geneva, and New York.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>City coordinates assigned</h3><p>Matched each post city to Natural Earth’s populated-places dataset and documented the map’s city-level geographic precision.</p></article><article><time dateTime="2026-08-28">28 August 2026</time><h3>Dashboard created</h3><p>Created the interactive world map, searchable post directory, post-type filters, source notes, maintenance history, and standard Factbook navigation.</p></article></div></section></div>}

    <footer className="fsp-footer"><a href="/">← Back to Factbook</a><span>Migration &amp; Foreign Affairs · July 2026</span></footer><a className="fsp-top" href="#top" aria-label="Back to top" title="Back to top">↑</a>
  </main>;
}
