"use client";

import { useState } from "react";

export default function ReligiousAffiliations() {
  const [showMaintenanceLog, setShowMaintenanceLog] = useState(false);
  return <main className="religion-dashboard-page" id="top">
    <iframe className="religion-full-app" src="/religious-affiliations/index.html?v=factbook-20260821-9" title="Religious Affiliation in the Philippines" />
    <section className="religion-source-standard" id="source">
      <p className="religion-source-kicker">About the data</p><h2>Census data,<br />made explorable.</h2>
      <div className="religion-source-grid">
        <article><b>Source</b><a href="https://psa.gov.ph/content/religious-affiliation-philippines-2020-census-population-and-housing" target="_blank" rel="noreferrer">PSA Religious Affiliation Statistical Tables ↗</a><p>Philippine Statistics Authority, 2020 Census of Population and Housing.</p></article>
        <article><b>Coverage</b><p>National, 17 census regions, 82 current province boundaries, and selected highly urbanized cities and NCR local government units. Municipal and city-level coverage is not nationwide.</p></article>
        <article><b>Reference period</b><p>2020 Census of Population and Housing. Statistical release dated 22 February 2023.</p></article>
        <article className="religion-source-history"><b>Dashboard history</b><dl><div><dt>Created</dt><dd>18 April 2026</dd></div><div><dt>Last review</dt><dd>21 August 2026</dd></div><div><dt>Last update</dt><dd>21 August 2026</dd></div></dl><button type="button" onClick={() => setShowMaintenanceLog(true)}>View maintenance log</button></article>
        <article className="religion-source-method"><b>Geographic treatment</b><p>Geographic classifications follow the 2020 Census. Sulu uses its current map boundary while retaining its 2020 religious-affiliation data and BARMM classification.</p><p>Highly urbanized cities reported separately by PSA are displayed in the city/municipality view and excluded from their corresponding provincial records.</p></article>
      </div>
    </section>
    {showMaintenanceLog && <div className="religion-log-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowMaintenanceLog(false); }}><section className="religion-change-log" role="dialog" aria-modal="true" aria-labelledby="religion-change-log-title">
      <header><div><p className="religion-source-kicker">Dashboard history</p><h2 id="religion-change-log-title">Maintenance Log</h2></div><button type="button" onClick={() => setShowMaintenanceLog(false)} aria-label="Close maintenance log">×</button></header>
      <div className="religion-log-summary"><time dateTime="2026-08-21">21 August 2026</time><h3>Geographic coverage review</h3><p>Reviewed the published PSA table against the dashboard’s region, province, and city/municipality boundary layers.</p></div>
      <ol>
        <li><div><span>Coverage disclosure added</span><b>Municipalities and cities</b></div><p>Clarified that city and municipal coverage is not nationwide and includes only the highly urbanized cities and NCR local government units reported separately by PSA.</p></li>
        <li><div><span>Administrative level corrected</span><b>Cebu City and Iloilo City</b></div><p>Moved both highly urbanized cities into the city/municipality view and restored the separate Cebu and Iloilo province records.</p></li>
        <li><div><span>Boundary crosswalk applied</span><b>Sulu</b></div><p>Matched the current Sulu boundary while retaining its 2020 Census religious-affiliation data and BARMM classification.</p></li>
        <li><div><span>Factbook styling updated</span><b>Dashboard interface</b></div><p>Standardized typography, navigation spacing, source documentation, dashboard history, and footer navigation.</p></li>
      </ol>
      <footer><time dateTime="2026-04-18">18 April 2026</time><p>Religious-affiliations dashboard created.</p></footer>
    </section></div>}
    <footer className="dash-footer religion-footer"><a href="/">← Back to Factbook</a><span>People &amp; Demography · 2020 Census</span></footer>
  </main>;
}
