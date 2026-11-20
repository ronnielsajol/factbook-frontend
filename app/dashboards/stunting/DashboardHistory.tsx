"use client";

import { useEffect, useState } from "react";

const entries = [
  { date: "24 August 2026", title: "Regional reconciliation and map usability updates", description: "Reconciled all 18 regional prevalence pairs against the DOST–FNRI source; corrected Cordillera, Central Visayas, and Caraga; aligned the lowest-prevalence ranking with the map data; removed an unused duplicate regional dataset; added a map reset control; and added local search for regions, provinces/HUCs, and mapped LGUs, including numeric region aliases and geographic zoom with data popups. Completed scoped lint and production-build verification." },
  { date: "21 August 2026", title: "Dashboard QA, visual system, and editorial corrections", description: "Completed dashboard QA; verified the map and regional data presentation; improved health-theme contrast, navigation, footer, and source metadata; clarified the survey sample-size label; simplified the About and profile sections; and removed redundant dividers and explanatory content." },
  { date: "19 August 2026", title: "Dashboard created and integrated into the Factbook", description: "Adapted the stunting dashboard for the Factbook and added survey sources, geographic views, child profiles, historical context, and mobile refinements." },
];

export default function DashboardHistory() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  return <>
    <section className="stunting-dashboard-history" aria-labelledby="stunting-history-title">
      <h3 id="stunting-history-title">Dashboard history</h3>
      <div className="stunting-history-dates">
        <div><span>Created</span><strong>19 August 2026</strong></div>
        <div><span>Last review</span><strong>24 August 2026</strong></div>
        <div><span>Last update</span><strong>24 August 2026</strong></div>
      </div>
      <button type="button" onClick={() => setOpen(true)}>View maintenance log</button>
    </section>
    {open && <div className="stunting-maintenance-backdrop">
          <button className="stunting-maintenance-dismiss" type="button" aria-label="Dismiss maintenance log" onClick={() => setOpen(false)} />
      <section className="stunting-maintenance-modal" role="dialog" aria-modal="true" aria-labelledby="stunting-maintenance-title">
        <header><div><p>Dashboard history</p><h2 id="stunting-maintenance-title">Maintenance Log</h2></div><button type="button" aria-label="Close maintenance log" onClick={() => setOpen(false)}>×</button></header>
        <div className="stunting-maintenance-entries">{entries.map((entry) => <article key={entry.date}><time>{entry.date}</time><h3>{entry.title}</h3><p>{entry.description}</p></article>)}</div>
        <footer><time>19 August 2026</time><span>Dashboard and stunting data integrated into the Factbook.</span></footer>
      </section>
    </div>}
  </>;
}
