'use client';
/* Keyboard access is needed for the horizontally scrollable source table. */
/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", {"roles": ["region"]}] */
import {useState} from 'react';
import data from '../../../public/data/school-safety/dashboard-data.json';
const items=[
 {id:'school_bullying',label:'Bullied on school property',group:'Bullying'},
 {id:'cyberbullying',label:'Cyberbullied',group:'Bullying'},
 {id:'no_close_friends',label:'No close friends',group:'Well-being'},
 {id:'short_sleep',label:'Less than eight hours of sleep',group:'Well-being'},
 {id:'parent_understanding_gap',label:'Parents never or rarely understood worries',group:'Family support'},
 {id:'parent_awareness_gap',label:'Parents never or rarely knew free-time activities',group:'Family support'},
 {id:'suicidal_ideation',label:'Seriously considered a suicide attempt',group:'Mental health'},
 {id:'suicide_attempt',label:'Reported at least one suicide attempt',group:'Mental health'},
];
const areas=['Philippines','Luzon','Visayas','Mindanao'];
const pct=(v:number)=>`${v.toFixed(1)}%`;
function estimate(id:string,sex='Total',area='Philippines'){return data.survey.find(r=>r.indicator_id===id&&r.sex===sex&&r.geography===area)!;}
export default function StudentNeeds(){
 const [id,setId]=useState('school_bullying'),[comparison,setComparison]=useState('islands'),[sex,setSex]=useState('Total'),[area,setArea]=useState('Philippines');
 const selected=items.find(i=>i.id===id)!;
 const national=estimate(id);
 const rows=comparison==='islands'?areas.map(a=>estimate(id,sex,a)):['Boys','Girls'].map(s=>estimate(id,s,area));
 const boys=estimate(id,'Boys',area),girls=estimate(id,'Girls',area);
 const difference=Math.abs(girls.value-boys.value);
 const comparisonCopy=comparison==='sex'
  ? difference===0?`Boys and girls have the same published estimate in ${area}.`
  : `The published estimate is ${difference.toFixed(1)} percentage points higher for ${girls.value>boys.value?'girls':'boys'} in ${area}.`
  : id==='school_bullying'?'Bullying on school property was reported across all three island groups.'
  : `Across the three island groups, estimates range from ${pct(Math.min(...rows.slice(1).map(r=>r.value)))} to ${pct(Math.max(...rows.slice(1).map(r=>r.value)))}.`;
 return <section id="student-needs" className="ss-section">
  <div className="ss-heading"><div><p className="ss-kicker">01 / Student-reported needs</p><h2>About 3 in 10 students reported<br/>bullying on school property.</h2></div><span className="ss-tag">WHO GSHS · 2024</span></div>
  <p className="ss-lead-stat"><strong>{pct(estimate('school_bullying').value)}</strong> in the previous 12 months <span>· 95% confidence interval: 28.3–32.1%</span></p>
  <p className="ss-context">Philippines · students aged 13–17 in the Grade 7–10 school survey. These estimates describe school-going adolescents and exclude those out of school.</p>
  <div className="ss-needs-heading"><h3>A broader picture of student needs</h3><p>National estimates · all students. Select an indicator to explore the comparisons below.</p></div>
  <div className="ss-needs-grid">{['Bullying','Well-being','Family support','Mental health'].map(group=><section className="ss-needs-group" key={group} aria-label={group}><h4>{group}</h4>{items.filter(i=>i.group===group).map(item=>{const r=estimate(item.id);return <button key={item.id} aria-pressed={id===item.id} aria-controls="ss-needs-comparison" onClick={()=>setId(item.id)}><span className="ss-indicator-name">{item.label}</span><strong>{pct(r.value)}</strong><small>{r.recall_period}</small><span className="ss-card-action">{id===item.id?'Selected':'Compare'} <span aria-hidden="true">→</span></span></button>;})}</section>)}</div>
  <p className="ss-needs-footnote">Indicators can overlap and use different recall periods; percentages should not be added. Thoughts and attempts are separate self-reports, not nested stages or clinical diagnoses.</p>
  <div className="ss-panel" id="ss-needs-comparison">
   <div className="ss-comparison-controls"><fieldset><legend>Choose a comparison</legend><div className="ss-segments"><button aria-pressed={comparison==='islands'} onClick={()=>setComparison('islands')}>Compare island groups</button><button aria-pressed={comparison==='sex'} onClick={()=>setComparison('sex')}>Compare boys and girls</button></div></fieldset>{comparison==='islands'?<label>Students included<select value={sex} onChange={e=>setSex(e.target.value)}><option value="Total">All students</option><option>Boys</option><option>Girls</option></select></label>:<label>Geography<select value={area} onChange={e=>setArea(e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select></label>}</div>
   <div className="ss-chart-heading" aria-live="polite"><p className="ss-kicker">{selected.group}</p><h3>{selected.label}</h3><p>{national.recall_period} · 2024 · {comparison==='islands'?(sex==='Total'?'All students':sex):area}</p><div className="ss-comparison-finding"><strong>{comparisonCopy}</strong><p>{comparison==='sex'?`Boys: ${pct(boys.value)}. Girls: ${pct(girls.value)}. `:null}Point estimates alone do not establish a statistically significant difference.</p></div></div>
   <figure className="ss-interval-chart" aria-label={`${selected.label}: ${comparison==='sex'?'boys and girls in '+area:'island groups, '+sex}`}><div className="ss-chart-axis" aria-hidden="true"><span/><div>{[0,25,50,75,100].map(n=><span key={n}>{n}%</span>)}</div><span>Estimate / 95% CI</span></div>{rows.map(r=><div key={r.record_id} className={`ss-interval-row ${comparison==='sex'?'ss-sex-row':''}`}><div><strong>{comparison==='sex'?r.sex:r.geography}</strong>{comparison==='islands'&&r.geography==='Philippines'&&<small>National reference</small>}</div><div className="ss-track" aria-hidden="true"><span className="ss-interval" style={{left:`${r.ci95_lower}%`,width:`${r.ci95_upper-r.ci95_lower}%`}}/><span className="ss-dot" style={{left:`${r.value}%`}}/></div><div className="ss-result"><strong>{pct(r.value)}</strong><small>{r.ci95_lower.toFixed(1)}–{r.ci95_upper.toFixed(1)}%</small></div></div>)}<figcaption><span className="ss-legend-dot"/> Estimate <span className="ss-legend-line"/> 95% confidence interval</figcaption></figure>
   <details className="ss-details"><summary>How to read these figures</summary><p>Percentages are published, survey-weighted estimates. The line around each dot shows its 95% confidence interval, expressing statistical uncertainty. The chart uses the same 0–100% scale for every indicator.</p><p>Differences between point estimates do not by themselves establish a meaningful ranking or a statistically significant difference. No significance tests were performed. The national figure is a published reference, not an average of the three island groups.</p><p>The national overview above always shows all students. Comparison controls change only the chart and its table. Each indicator retains its own recall period.</p></details>
   <details className="ss-details"><summary>View exact estimates and sources</summary><div className="ss-table-scroll" tabIndex={0} role="region" aria-label="Survey estimates"><table><caption>{national.indicator} · {national.recall_period} · 2024</caption><thead><tr><th scope="col">Geography</th><th scope="col">Students</th><th scope="col">Estimate</th><th scope="col">95% interval</th><th scope="col">Source</th></tr></thead><tbody>{rows.map(r=><tr key={r.record_id}><th scope="row">{r.geography}</th><td>{r.sex==='Total'?'All students':r.sex}</td><td>{pct(r.value)}</td><td>{r.ci95_lower.toFixed(1)}–{r.ci95_upper.toFixed(1)}%</td><td><a href={r.source_url} target="_blank" rel="noreferrer">WHO · p. {r.source_page} ↗</a></td></tr>)}</tbody></table></div></details>
   <div className="ss-panel-footer"><a href="/data/school-safety/student-needs-2024.csv" download>Download all 96 estimates ↓</a><a href="#sources">Sources &amp; coverage ↗</a></div>
  </div>
 </section>;
}
