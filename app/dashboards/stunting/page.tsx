import type { Metadata } from "next";
import DashboardHistory from "./DashboardHistory";
import HistoricalContext from "./HistoricalContext";

const title = "Stunting in the Philippines — Factbook";
const description = "Explore child stunting prevalence across Philippine regions, provinces, highly urbanized cities, and priority areas.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: [] },
  twitter: { title, description, images: [] },
};

const profiles = [
  { number: "27.8%", label: "Rural children", note: "Significantly higher than 23.2% among children in urban areas." },
  { number: "37.8%", label: "Poorest households", note: "More than three times the 11.9% rate among the richest households." },
  { number: "26.7%", label: "Boys", note: "Compared with 23.8% among girls under five." },
];

const regionalExtremes = {
  highest: [
    ["BARMM", "36.0%"],
    ["Region IX · Zamboanga Peninsula", "34.6%"],
    ["Negros Island Region", "30.9%"],
    ["MIMAROPA", "30.3%"],
    ["Region V · Bicol Region", "29.8%"],
  ],
  lowest: [
    ["Region III · Central Luzon", "18.1%"],
    ["Region VI · Western Visayas", "19.0%"],
    ["Region IV-A · CALABARZON", "21.2%"],
    ["Region VII · Central Visayas", "22.7%"],
    ["Region II · Cagayan Valley", "22.8%"],
  ],
};

export default function StuntingDashboard() {
  return <main className="stunting-dashboard" id="top">
    <header className="stunting-nav">
      <a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a>
      <nav aria-label="Dashboard sections"><a href="#map">Explore the Stunting Map</a><a href="#profiles">Who is most affected?</a><a href="#context">Poverty &amp; Historical Data</a><a href="#source">About</a></nav>
    </header>

    <section className="stunting-hero">
      <div><p className="dash-kicker">Health · Child nutrition</p><h1>Stunting in<br />the <em>Philippines.</em></h1><p className="stunting-deck">One in every four Filipino children under five is stunted. Explore how prevalence differs across the country—and which children face the greatest risk.</p></div>
      <aside className="stunting-hero-stat"><span>National prevalence · 2025</span><strong>25.3%</strong><p><b>+1.7 points</b> from 23.6% in 2023</p><small>WHO prevalence level: <b>High</b></small></aside>
    </section>

    <section className="stunting-orientation">
      <p className="dash-kicker">Reading the measure</p>
      <div><h2>Height tells a longer story.</h2><p>Stunting describes low height for age. It reflects chronic or repeated undernutrition and is associated with conditions that accumulate over time—not simply a child being short.</p></div>
    </section>

    <section className="stunting-map-section" id="map">
      <div className="stunting-section-head"><div><p className="dash-kicker">Explore the Stunting Map</p><h2>Where is stunting<br />most prevalent?</h2></div><p>Switch among regions, provinces and highly urbanized cities, top local governments, and PPAN priority areas. Select a place or WHO level to investigate.</p></div>
      <div className="stunting-scale" aria-label="WHO stunting prevalence thresholds">
        <span><i className="very-low" /><b>Very low</b><small>Below 2.5%</small></span><span><i className="low" /><b>Low</b><small>2.5–&lt;10%</small></span><span><i className="medium" /><b>Medium</b><small>10–&lt;20%</small></span><span><i className="high" /><b>High</b><small>20–&lt;30%</small></span><span><i className="very-high" /><b>Very high</b><small>30% or more</small></span>
      </div>
      <div className="stunting-map-frame-wrap"><iframe className="stunting-map-frame" src="/stunting/index.html?v=factbook-20260824-6" title="Interactive map of stunting prevalence in the Philippines" /></div>
      <section className="stunting-regional-extremes" aria-labelledby="regional-extremes-title">
        <header><div><p className="dash-kicker">Regional prevalence · 2025</p><h3 id="regional-extremes-title">Where prevalence is highest—and lowest.</h3></div><p>Ranked using regional estimates from the DOST–FNRI 2025 Updating Survey.</p></header>
        <div className="stunting-extremes-grid">
          <article className="highest"><h4>Highest prevalence</h4><ol>{regionalExtremes.highest.map(([name, value], index) => <li key={name}><span><small>0{index + 1}</small>{name}</span><strong>{value}</strong></li>)}</ol></article>
          <article className="lowest"><h4>Lowest prevalence</h4><ol>{regionalExtremes.lowest.map(([name, value], index) => <li key={name}><span><small>0{index + 1}</small>{name}</span><strong>{value}</strong></li>)}</ol></article>
        </div>
      </section>
    </section>

    <section className="stunting-profiles" id="profiles">
      <div className="stunting-section-head"><div><p className="dash-kicker">Who is most affected? · 2025</p><h2>The burden is<br />not evenly shared.</h2></div><p>This section compares prevalence by place of residence, household wealth, and sex. The survey identifies the rural–urban difference as statistically significant.</p></div>
      <div className="stunting-profile-grid">{profiles.map((profile, index) => <article key={profile.label}><span>0{index + 1}</span><strong>{profile.number}</strong><h3>{profile.label}</h3><p>{profile.note}</p></article>)}</div>
      <aside className="stunting-equity-note"><strong>The largest observed gap is economic.</strong><p>Stunting prevalence is 25.9 percentage points higher among children in the poorest households than among those in the richest households. This is a descriptive comparison.</p></aside>
        <aside className="stunting-profile-source"><span>Source</span><p><a href="https://enutrition.fnri.dost.gov.ph/presentation.php" target="_blank" rel="noreferrer">DOST–FNRI 2025 Updating Survey – Anthropometry ↗</a><small>Children under five · pages 11–12 · survey sample: 11,122 children</small></p></aside>
    </section>

    <section className="stunting-age-pattern" id="age-pattern" aria-labelledby="age-pattern-title">
      <header><div><p className="dash-kicker">Age profile · 2025</p><h2 id="age-pattern-title">Prevalence rises sharply after six months.</h2></div><p>Stunting prevalence more than doubles between infancy and 12–23 months, then reaches its highest observed level at 24–35 months. This pattern overlaps the first 1,000 days—from pregnancy to a child’s second birthday—a critical window for nutrition.</p></header>
      <ol aria-label="Stunting prevalence by age group">
        <li><span>0–5 months</span><strong>11.2%</strong></li>
        <li><span>6–11 months</span><strong>16.6%</strong></li>
        <li><span>12–23 months</span><strong>27.3%</strong></li>
        <li><span>24–35 months</span><strong>31.5%</strong></li>
      </ol>
        <aside className="stunting-profile-source"><span>Source</span><p><a href="https://enutrition.fnri.dost.gov.ph/presentation.php" target="_blank" rel="noreferrer">DOST–FNRI 2025 Updating Survey – Anthropometry ↗</a><small>Children under five · page 11 · survey sample: 11,122 children</small></p></aside>
    </section>

    <section className="stunting-drivers" id="drivers" aria-labelledby="drivers-title">
      <header><div><p className="dash-kicker">Why risk accumulates</p><h2 id="drivers-title">Stunting rarely has<br />a single cause.</h2></div><p>Research on socioeconomic inequality in child stunting identifies several overlapping conditions across pregnancy, caregiving, and early childhood.</p></header>
      <div className="stunting-driver-grid">
        <article><span>01</span><h3>Maternal nutrition</h3><p>A mother’s nutritional status is associated with a child’s growth before and after birth.</p></article>
        <article><span>02</span><h3>Knowledge and care</h3><p>Education and access to quality prenatal care can shape nutrition knowledge and support.</p></article>
        <article><span>03</span><h3>Complementary feeding</h3><p>Diet quality and diversity become especially important for children from 6–23 months.</p></article>
        <article><span>04</span><h3>Household conditions</h3><p>Income and unequal access to food and health services influence the conditions in which children grow.</p></article>
      </div>
      <aside className="stunting-driver-source"><span>Research source</span><p><a href="https://www.pids.gov.ph/publication/discussion-papers/the-determinants-of-the-socioeconomic-inequality-and-the-trajectory-of-child-stunting-in-the-philippines" target="_blank" rel="noreferrer">The Determinants of the Socioeconomic Inequality and the Trajectory of Child Stunting in the Philippines ↗</a><small>Philippine Institute for Development Studies · Discussion Paper 2023-04</small></p></aside>
    </section>

    <section className="stunting-context" id="context">
      <div className="stunting-section-head"><div><p className="dash-kicker">Poverty and historical context</p><h2>Older evidence<br />still adds context.</h2></div><p>Explore the relationship with poverty and review the latest available ENNS province and HUC profiles. OPT+ values remain separate context—not evidence of improvement or deterioration.</p></div>
      <aside className="stunting-viewing-note"><b>Viewing tip</b><span>These detailed comparisons are easiest to explore on a larger screen. On mobile, the same data remains available in a streamlined stacked layout.</span></aside>
      <HistoricalContext />
    </section>

    <section className="stunting-source" id="source">
      <p className="dash-kicker">About the data</p><h2>Sources and coverage.</h2>
	      <div className="stunting-about-grid">
	        <article className="stunting-about-sources">
	          <b>Sources</b>
	          <ul className="stunting-about-source-list">
	            <li>
	              <a href="https://enutrition.fnri.dost.gov.ph/presentation.php" target="_blank" rel="noreferrer">
	                2025 Updating Survey presentations ↗
	              </a>
	              <small>DOST–FNRI eNutrition</small>
	            </li>
	            <li>
	              <a href="https://enutrition.fnri.dost.gov.ph/logs.php?view=monograph" target="_blank" rel="noreferrer">
	                2018, 2019, and 2021 ENNS monographs ↗
	              </a>
	              <small>DOST–FNRI eNutrition</small>
	            </li>
	            <li>
	              <a href="https://heatmap.fnri.dost.gov.ph/" target="_blank" rel="noreferrer">
	                Nutrition and food-security survey explorer ↗
	              </a>
	              <small>DOST–FNRI HEATmap</small>
	            </li>
	            <li>
	              <a href="https://nnc.gov.ph/plans-and-programs/philippine-plan-of-action-for-nutrition-ppan/" target="_blank" rel="noreferrer">
	                Philippine Plan of Action for Nutrition 2023–2028 ↗
	              </a>
	              <small>National Nutrition Council</small>
	            </li>
	            <li>
	              <a href="https://www.who.int/data/nutrition/nlis/info/malnutrition-in-children" target="_blank" rel="noreferrer">
	                Stunting definition and prevalence thresholds ↗
	              </a>
	              <small>World Health Organization</small>
	            </li>
	          </ul>
	        </article>
        <article className="stunting-about-details">
          <div>
            <b>Coverage</b>
            <p>National and regional estimates, child profiles, and available province and highly urbanized city records.</p>
          </div>
          <div>
            <b>Reference period</b>
            <p>2018–2025, depending on geography and source.</p>
          </div>
        </article>
      </div>
      <DashboardHistory />
    </section>

    <a className="back-to-top" href="#top" aria-label="Back to top">↑</a>
    <footer className="dash-footer stunting-footer"><a href="/">← Back to Factbook</a><span>Health</span></footer>
  </main>;
}
