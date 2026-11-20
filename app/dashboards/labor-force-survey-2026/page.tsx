"use client";

import { useEffect, useRef, useState } from "react";
import "./lfs.css";
import LaborGeography from "./LaborGeography";

type Period = "Jun 2025" | "Mar 2026" | "Apr 2026" | "May 2026" | "Jun 2026";
const periods: Period[] = ["Jun 2025", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026"];
const pulse = {
  "Jun 2025": { population:79.78, labor:52.42, employed:50.47, unemployed:1.95, underemployed:5.76, lfpr:65.7, employment:96.3, unemployment:3.7, underemployment:11.4, hours:40.5 },
  "Mar 2026": { population:81.56, labor:51.65, employed:49.07, unemployed:2.58, underemployed:6.03, lfpr:63.3, employment:95.0, unemployment:5.0, underemployment:12.3, hours:40.7 },
  "Apr 2026": { population:81.85, labor:51.30, employed:48.89, unemployed:2.41, underemployed:7.41, lfpr:62.7, employment:95.3, unemployment:4.7, underemployment:15.2, hours:40.2 },
  "May 2026": { population:81.69, labor:52.13, employed:49.63, unemployed:2.50, underemployed:6.04, lfpr:63.8, employment:95.2, unemployment:4.8, underemployment:12.2, hours:41.1 },
  "Jun 2026": { population:81.79, labor:53.25, employed:50.66, unemployed:2.59, underemployed:6.11, lfpr:65.1, employment:95.1, unemployment:4.9, underemployment:12.1, hours:40.6 },
};
const sectors = [{name:"Services",share:62.7,count:31.77,color:"#287a8a"},{name:"Agriculture",share:20.0,count:10.12,color:"#667a3a"},{name:"Industry",share:17.3,count:8.78,color:"#3978b7"}];
type TrendSeries = { name:string; short:string; values:number[]; color:string };
const occupationTrends: TrendSeries[] = [
  {name:"Elementary occupations",short:"Elementary",values:[29.818,25.090,26.765,27.050,27.860],color:"#287a8a"},
  {name:"Service and sales workers",short:"Service & sales",values:[23.443,24.265,23.896,24.665,23.837],color:"#b34d83"},
  {name:"Skilled agricultural, forestry, and fishery workers",short:"Skilled agriculture",values:[10.625,10.272,10.444,10.640,10.834],color:"#667a3a"},
  {name:"Plant and machine operators and assemblers",short:"Plant & machine",values:[8.510,9.244,8.936,8.831,8.274],color:"#3978b7"},
  {name:"Clerical support workers",short:"Clerical support",values:[8.355,8.624,8.141,8.156,8.469],color:"#d27a36"},
  {name:"Craft and related trades workers",short:"Craft & trades",values:[6.566,8.039,7.141,7.181,6.416],color:"#338e91"},
  {name:"Professionals",short:"Professionals",values:[5.399,6.290,6.039,5.881,6.218],color:"#785c9c"},
  {name:"Technicians and associate professionals",short:"Technicians",values:[4.036,4.366,4.297,3.909,4.358],color:"#c28a24"},
  {name:"Managers",short:"Managers",values:[3.132,3.637,4.076,3.456,3.574],color:"#c84d4d"},
  {name:"Armed forces occupations",short:"Armed forces",values:[0.115,0.173,0.267,0.231,0.160],color:"#52615a"},
];
const classTrends: TrendSeries[] = [
  {name:"Wage and salary workers",short:"Wage & salary",values:[63.046,63.695,64.434,64.255,64.074],color:"#287a8a"},
  {name:"Self-employed without any paid employee",short:"Self-employed",values:[27.068,27.848,27.754,27.200,26.926],color:"#3978b7"},
  {name:"Unpaid family workers",short:"Unpaid family",values:[8.019,6.835,5.806,6.776,7.366],color:"#b34d83"},
  {name:"Employers in own family-operated farm or business",short:"Employers",values:[1.866,1.623,2.006,1.770,1.634],color:"#d27a36"},
];
type SectorDetail = "Agriculture" | "Industry" | "Services";
const subsectorData: Record<SectorDetail,{name:string;values:number[]}[]> = {
  Agriculture:[
    {name:"Agriculture and forestry",values:[84.827,89.524,86.763,86.401,88.782]},
    {name:"Fishing and aquaculture",values:[15.173,10.476,13.238,13.599,11.218]},
  ],
  Industry:[
    {name:"Construction",values:[57.078,53.856,53.741,54.437,56.279]},
    {name:"Manufacturing",values:[39.071,40.351,40.088,40.012,39.397]},
    {name:"Mining and quarrying",values:[2.063,3.693,3.872,3.859,2.800]},
    {name:"Electricity, gas, steam and air conditioning",values:[1.165,1.145,1.238,0.897,0.666]},
    {name:"Water supply, sewerage and waste management",values:[0.623,0.956,1.061,0.795,0.859]},
  ],
  Services:[
    {name:"Wholesale and retail trade; vehicle repair",values:[34.936,32.059,31.692,31.720,31.277]},
    {name:"Transportation and storage",values:[12.257,13.110,12.986,12.449,11.842]},
    {name:"Accommodation and food services",values:[8.976,10.191,10.187,10.991,10.279]},
    {name:"Administrative and support services",values:[9.017,9.763,9.710,10.149,10.243]},
    {name:"Other service activities",values:[10.425,9.202,9.574,9.063,10.122]},
    {name:"Public administration and defense",values:[9.006,8.791,9.898,9.268,10.180]},
    {name:"Education",values:[4.925,6.122,5.704,5.651,5.924]},
    {name:"Human health and social work",values:[2.833,2.666,2.490,2.902,2.472]},
    {name:"Financial and insurance activities",values:[2.837,2.526,2.445,2.017,2.155]},
    {name:"Information and communication",values:[1.572,1.828,1.611,1.780,1.644]},
    {name:"Professional, scientific and technical",values:[1.239,1.555,1.244,1.274,1.438]},
    {name:"Arts, entertainment and recreation",values:[0.939,1.189,1.531,1.712,1.447]},
    {name:"Real estate activities",values:[1.038,0.993,0.928,1.023,0.979]},
    {name:"Extraterritorial organizations and bodies",values:[0,0.005,0,0,0]},
  ],
};
const hoursWorked = [
  {period:"Jun 2025",under40:31.231,fortyPlus:67.697,notAtWork:1.072,mean:40.502},
  {period:"Mar 2026",under40:29.424,fortyPlus:69.625,notAtWork:0.951,mean:40.680},
  {period:"Apr 2026",under40:32.845,fortyPlus:65.012,notAtWork:2.142,mean:40.227},
  {period:"May 2026",under40:29.180,fortyPlus:69.233,notAtWork:1.587,mean:41.052},
  {period:"Jun 2026",under40:29.049,fortyPlus:69.612,notAtWork:1.340,mean:40.638},
];
const underemploymentHours = [
  {period:"Jun 2025",fortyPlus:37.552,under40:61.131,notAtWork:1.317},
  {period:"Mar 2026",fortyPlus:40.476,under40:58.221,notAtWork:1.304},
  {period:"Apr 2026",fortyPlus:43.161,under40:55.316,notAtWork:1.523},
  {period:"May 2026",fortyPlus:46.261,under40:51.967,notAtWork:1.772},
  {period:"Jun 2026",fortyPlus:48.084,under40:48.938,notAtWork:2.979},
];
const underemploymentSectors = [
  {period:"Jun 2025",agriculture:31.507,industry:17.082,services:51.413},
  {period:"Mar 2026",agriculture:31.447,industry:16.891,services:51.662},
  {period:"Apr 2026",agriculture:27.727,industry:20.093,services:52.181},
  {period:"May 2026",agriculture:28.694,industry:19.286,services:52.021},
  {period:"Jun 2026",agriculture:27.843,industry:17.484,services:54.674},
];
type UnemploymentProfile = "Age" | "Sex" | "Education";
const unemploymentProfiles: Record<UnemploymentProfile,{name:string;values:number[]}[]> = {
  Age:[
    {name:"15–24",values:[31.984,32.116,35.685,34.661,37.779]},{name:"25–34",values:[37.833,38.874,38.252,38.018,38.055]},{name:"35–44",values:[14.398,12.538,13.006,13.692,12.638]},{name:"45–54",values:[8.723,10.239,7.666,7.294,6.266]},{name:"55–64",values:[6.142,5.301,4.629,5.456,3.778]},{name:"65 and over",values:[0.921,0.933,0.762,0.880,1.483]},
  ],
  Sex:[{name:"Male",values:[57.881,56.307,58.728,57.891,61.278]},{name:"Female",values:[42.119,43.693,41.272,42.109,38.722]}],
  Education:[
    {name:"College",values:[50.357,46.194,45.029,48.880,48.357]},{name:"Junior high school",values:[22.796,26.729,28.084,26.997,27.053]},{name:"Senior high school",values:[12.962,14.614,13.620,12.126,14.922]},{name:"Elementary",values:[9.383,7.985,9.734,7.533,7.114]},{name:"Post-secondary",values:[3.804,4.426,2.993,4.195,2.345]},{name:"No grade completed",values:[0.698,0.052,0.539,0.268,0.208]},
  ],
};
type WorkReasonGroup = "Under 40 Hours" | "More Than 48 Hours" | "Job, Not at Work";
const workReasonData: Record<WorkReasonGroup,{name:string;values:number[]}[]> = {
  "Under 40 Hours":[
    {name:"Variable schedule or nature of work",values:[64.143,66.483,63.356,70.237,68.779]},{name:"School or training",values:[7.177,9.361,4.503,4.563,7.399]},{name:"Personal or family reasons",values:[7.827,5.744,4.913,5.894,6.540]},{name:"Poor business conditions",values:[3.987,4.556,5.481,3.845,4.357]},{name:"Health or medical limitations",values:[4.744,3.963,3.538,4.015,3.881]},{name:"Reduction in clients or work",values:[2.403,2.824,2.715,3.410,2.094]},{name:"Low or off season",values:[1.835,2.387,2.247,2.642,1.171]},{name:"Could only find part-time work",values:[1.337,1.859,1.907,1.732,1.329]},{name:"Bad weather or natural disaster",values:[3.916,1.858,1.209,1.206,2.843]},{name:"Start, end, or change of job",values:[0.968,0.743,0.788,0.551,0.814]},{name:"Other reasons",values:[0.534,0.177,1.237,1.288,0.296]},{name:"Holidays",values:[1.121,0.013,7.991,0.593,0.466]},
  ],
  "More Than 48 Hours":[
    {name:"Wanted more earnings",values:[64.748,69.090,63.804,65.593,65.982]},{name:"Requirements of the job",values:[34.188,29.839,34.366,33.680,33.100]},{name:"Exceptional week",values:[0.551,0.556,0.633,0.397,0.459]},{name:"Ambition or passion for the job",values:[0.492,0.515,1.086,0.330,0.415]},{name:"Other reasons",values:[0.022,0,0.094,0,0.023]},
  ],
  "Job, Not at Work":[
    {name:"Personal or family reasons",values:[20.529,26.855,7.673,11.611,12.544]},{name:"Variable schedule or nature of work",values:[14.566,22.498,21.201,26.636,17.970]},{name:"Low or off season",values:[5.648,20.793,6.334,2.332,9.228]},{name:"Health or medical limitations",values:[14.945,8.480,9.806,8.615,10.156]},{name:"School or training",values:[1.219,7.224,0.876,1.241,4.320]},{name:"Other reasons",values:[17.767,5.114,29.823,23.564,10.970]},{name:"Bad weather or natural disaster",values:[8.416,2.790,1.588,0.843,11.975]},{name:"Poor business conditions",values:[10.471,2.695,5.762,7.027,9.708]},{name:"Holidays",values:[2.128,1.553,12.647,12.033,0.232]},{name:"Start, end, or change of job",values:[3.380,1.276,1.743,4.103,4.491]},{name:"Reduction in clients or work",values:[0.650,0.531,1.690,0.518,7.670]},{name:"Could only find part-time work",values:[0.281,0.192,0.790,1.478,0.736]},
  ],
};
const industries = [
  {name:"Accommodation & food services",annual:481,monthly:-104},{name:"Administrative & support services",annual:456,monthly:143},{name:"Public administration & defense",annual:440,monthly:393},{name:"Education",annual:354,monthly:150},{name:"Arts, entertainment & recreation",annual:168,monthly:-65},{name:"Wholesale & retail trade; vehicle repair",annual:-903,monthly:213},{name:"Fishing & aquaculture",annual:-467,monthly:-207},{name:"Financial & insurance activities",annual:-195,monthly:66},{name:"Construction",annual:-139,monthly:-17},{name:"Human health & social work",annual:-94,monthly:-104},
];
const fmt = (n:number) => n.toFixed(1);

function TrendChart({series,active,onSelect,yMax,legendFooter}:{series:TrendSeries[];active:string|null;onSelect:(name:string|null)=>void;yMax:number;legendFooter?:React.ReactNode}) {
  const xs = periods.map((_,i)=>70+i*(660/(periods.length-1))); const top=34; const bottom=550; const y=(value:number)=>top+(1-value/yMax)*(bottom-top);
  const ticks=[0,yMax/4,yMax/2,yMax*3/4,yMax];
  return <div className="lfs-trend-layout"><div className="lfs-line-chart"><svg viewBox="0 0 810 610" role="img" aria-label={`Share of employed people by ${series===occupationTrends?"occupation":"class of worker"}, June 2025 to June 2026`}>
    {ticks.map(t=><g key={t}><line x1="70" x2="730" y1={y(t)} y2={y(t)}/><text x="56" y={y(t)+4}>{t.toFixed(0)}%</text></g>)}
    {series.map(s=>{const selected=s.name===active;const points=s.values.map((v,i)=>`${xs[i]},${y(v)}`).join(" ");return <g key={s.name} className={active===null?"overview":selected?"selected":"muted"} onClick={()=>onSelect(active===s.name?null:s.name)} aria-label={`${s.name}: ${s.values.map((v,i)=>`${periods[i]} ${v.toFixed(1)}%`).join(", ")}`}><polyline points={points} style={{stroke:s.color}}/>{s.values.map((v,i)=><circle key={i} cx={xs[i]} cy={y(v)} r={selected?5:3.5} style={{fill:s.color}}/>)}</g>})}
    {periods.map((label,i)=><text className="x-label" key={label} x={xs[i]} y="590">{label}</text>)}
  </svg></div><div className="lfs-series-list">{series.map(s=>{const latest=s.values.length-1;const delta=s.values[latest]-s.values[0];return <button key={s.name} className={s.name===active?"active":""} aria-pressed={s.name===active} onClick={()=>onSelect(active===s.name?null:s.name)}><i style={{background:s.color}}/><span><strong>{s.short}</strong><small>{s.name}</small></span><b>{s.values[latest].toFixed(1)}%</b><em className={delta<0?"down":""}>{delta>=0?"+":""}{delta.toFixed(1)} pts</em></button>})}{legendFooter}</div></div>;
}

export default function LaborForceSurvey2026() {
  const navRef = useRef<HTMLElement|null>(null);
  const [navCanScroll,setNavCanScroll] = useState(false);
  const [period,setPeriod] = useState<Period>("Jun 2026");
  const [change,setChange] = useState<"annual"|"monthly">("annual");
  const [occupation,setOccupation] = useState<string|null>(null);
  const [workerType,setWorkerType] = useState<string|null>(null);
  const [table2Sector,setTable2Sector] = useState<SectorDetail>("Services");
  const [table2Period,setTable2Period] = useState<Period>("Jun 2026");
  const [unemploymentProfile,setUnemploymentProfile] = useState<UnemploymentProfile>("Age");
  const [table3Period,setTable3Period] = useState<Period>("Jun 2026");
  const [workReasonGroup,setWorkReasonGroup] = useState<WorkReasonGroup>("Under 40 Hours");
  const [workReasonPeriod,setWorkReasonPeriod] = useState<Period>("Jun 2026");
  const [showMaintenanceLog,setShowMaintenanceLog] = useState(false);
  useEffect(()=>{
    const nav=navRef.current;
    if(!nav)return;
    const update=()=>setNavCanScroll(nav.scrollLeft+nav.clientWidth<nav.scrollWidth-4);
    update();
    nav.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return()=>{nav.removeEventListener("scroll",update);window.removeEventListener("resize",update)};
  },[]);
  useEffect(()=>{
    if(!showMaintenanceLog)return;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setShowMaintenanceLog(false)};
    window.addEventListener("keydown",close);
    return()=>window.removeEventListener("keydown",close);
  },[showMaintenanceLog]);
  const p = pulse[period];
  const maxChange = Math.max(...industries.map(d => Math.abs(d[change])));
  const table2PeriodIndex = periods.indexOf(table2Period);
  const selectedSubsectors = [...subsectorData[table2Sector]].sort((a,b)=>b.values[table2PeriodIndex]-a.values[table2PeriodIndex]);
  const maxSubsector = Math.max(...selectedSubsectors.map(d=>d.values[table2PeriodIndex]));
  const table3PeriodIndex = periods.indexOf(table3Period);
  const selectedUnemploymentProfile = [...unemploymentProfiles[unemploymentProfile]].sort((a,b)=>b.values[table3PeriodIndex]-a.values[table3PeriodIndex]);
  const maxUnemploymentProfile = Math.max(...selectedUnemploymentProfile.map(d=>d.values[table3PeriodIndex]));
  const workReasonPeriodIndex = periods.indexOf(workReasonPeriod);
  const selectedWorkReasons = [...workReasonData[workReasonGroup]].filter(d=>d.values[workReasonPeriodIndex]>=0.05).sort((a,b)=>b.values[workReasonPeriodIndex]-a.values[workReasonPeriodIndex]);
  const maxWorkReason = Math.max(...selectedWorkReasons.map(d=>d.values[workReasonPeriodIndex]));
  return <main className="lfs" id="top">
    <header className="lfs-nav"><a href="/" className="dash-brand"><span>DATA</span><strong>Factbook</strong></a><div className={`lfs-nav-row${navCanScroll?" can-scroll":""}`}><nav ref={navRef}><a href="#pulse">Overview</a><a href="#table-1">Composition</a><a href="#table-2">Sectors &amp; Hours</a><a href="#table-3">Labor Gaps</a><a href="#industries">Employment Change</a><a href="#geography">Labor Market Map</a><a href="#source">About</a></nav><button className="lfs-nav-more" type="button" aria-label="Show more navigation links" onClick={()=>navRef.current?.scrollBy({left:Math.max(240,navRef.current.clientWidth*.7),behavior:"smooth"})}>→</button></div></header>
    <section className="lfs-hero">
      <div><p className="lfs-kicker">Demographics &amp; Social Development · Philippines</p><h1>Philippine Labor<br/>Force Survey</h1><p>A visual overview of the June 2026 results, covering labor-force participation, employment, working hours, underemployment, and unemployment.</p><div className="lfs-release-meta"><span><b>Data reference period</b>June 2026</span><span><b>Published by the Philippine Statistics Authority</b>6 August 2026</span><span><b>PSA publication ID</b>Reference No. 2026-255</span></div></div>
      <aside className="lfs-hero-snapshot"><p className="lfs-kicker">June 2026 snapshot</p><article className="primary"><span>In the labor force</span><strong>53.25M</strong><small>65.1% of the population aged 15+</small></article><div><article><span>Employed</span><strong>50.66M</strong><small>95.1% of the labor force</small></article><article><span>Unemployed</span><strong>2.59M</strong><small>4.9% of the labor force</small></article></div></aside>
    </section>
    <section className="lfs-pulse" id="pulse">
      <div className="lfs-section-head"><div><p className="lfs-kicker">01 · National pulse</p><h2>Who is in the labor market?</h2></div><div className="lfs-periods" aria-label="Select reference period">{periods.map(item=><button key={item} className={period===item?"active":""} aria-pressed={period===item} onClick={()=>setPeriod(item)}>{item}</button>)}</div></div>
      <div className="lfs-donut-story integrated"><article>
        <div className="lfs-donut-heading"><span>Estimated population aged 15+</span><strong>{p.population.toFixed(2)}M</strong><p>Of the estimated <b>{p.population.toFixed(2)} million Filipinos aged 15+</b>, <b>{fmt(p.lfpr)}%</b>, equivalent to <b>{p.labor.toFixed(2)} million people</b>, were working or actively looking for work in {period}. The remaining <b>{fmt(100-p.lfpr)}%</b>, or <b>{(p.population-p.labor).toFixed(2)} million people</b>, were outside the labor force. They were neither working nor actively looking for work.</p></div>
        <div className="lfs-donut-layout"><div className="lfs-donut" style={{background:`conic-gradient(var(--labor) 0 ${p.lfpr}%, #d8d5cb ${p.lfpr}% 100%)`}}><div><strong>{fmt(p.lfpr)}%</strong><span>participate</span></div></div><div className="lfs-donut-legend nested"><section><header><i/><span><b>In the labor force</b><strong>{p.labor.toFixed(2)}M</strong><small>Working or looking for work · {fmt(p.lfpr)}% of the population aged 15+</small></span></header><div className="lfs-status-bar-wrap"><div className="lfs-status-bar" role="img" aria-label={`${p.employment}% employed and ${p.unemployment}% unemployed`}><i style={{width:`${p.employment}%`}}/><i style={{width:`${p.unemployment}%`}}/></div><div className="lfs-status-labels"><p><i/><span><b>Employed</b><strong>{p.employed.toFixed(2)}M</strong><small>{fmt(p.employment)}% of the labor force</small></span></p><p><i/><span><b>Unemployed</b><strong>{p.unemployed.toFixed(2)}M</strong><small>{fmt(p.unemployment)}% of the labor force</small></span></p></div><div className="lfs-employed-detail"><span>Of those <b>employed</b>:</span><div><article><strong>{p.underemployed.toFixed(2)}M</strong><b>underemployed</b><small>Wanted more hours or another job · {fmt(p.underemployment)}% of employed people</small></article><article><strong>{fmt(p.hours)} <em>hours</em></strong><b>average workweek</b><small>Mean hours worked per employed person</small></article></div></div></div></section><section className="outside"><header><i/><span><b>Outside the labor force</b><strong>{(p.population-p.labor).toFixed(2)}M</strong><small>Not working and not actively looking · {fmt(100-p.lfpr)}% of the population aged 15+</small></span></header></section></div></div>
      </article></div>
    </section>
    <section className="lfs-sectors" id="table-1"><div className="lfs-section-head"><div><p className="lfs-kicker">02 · Employment composition</p><h2>What kinds of work employ Filipinos?</h2></div><p>See how the employed population is distributed across sectors, occupations, and employment arrangements. Shares are estimates; precision measures are available in the PSA source files.</p></div><div className="lfs-table1-total"><span>Employed people · June 2026</span><strong>50.66M</strong><small>up 1.03 million from May 2026 and 184,000 from June 2025</small></div><section className="lfs-table1-chart lfs-sector-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 1 · By economic sector</p><h3>Services employ nearly two in three Filipinos.</h3></div><p>Services, agriculture, and industry divide the economy into three broad sectors. Together, they account for <b>all 50.66 million employed people</b> in June 2026.</p></div><div className="lfs-sector-visual"><div className="lfs-sector-pie" role="img" aria-label="Employment by sector: Services 62.7%, Agriculture 20.0%, Industry 17.3%"><div><strong>50.66M</strong><span>employed people</span></div></div><div className="lfs-sector-legend">{sectors.map((s,i)=><article key={s.name} style={{"--sector":s.color} as React.CSSProperties}><i/><span>0{i+1}</span><div><h3>{s.name}</h3><p>{s.count.toFixed(2)} million employed</p></div><strong>{fmt(s.share)}%</strong></article>)}</div></div></section>
      <div className="lfs-view-bridge"><span>Same 50.66M workforce</span><strong>From sector to occupation</strong><p><b>62.7%</b> worked in the services sector. The next view regroups all employed people by the jobs they performed.</p></div>
      <section className="lfs-table1-chart"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 2 · By occupation</p><h3>Elementary occupations remain the largest group.</h3></div><p><b>The 62.7% above refers to the services sector. Elementary occupations account for 27.9% of all employed people.</b> In the PSA classification, these are routine, often manual jobs such as cleaning, farm and construction labor, freight handling, kitchen help, and street services. Select a line or label to explore each occupation.</p></div><TrendChart series={occupationTrends} active={occupation} onSelect={setOccupation} yMax={30}/><div className="lfs-insight-row"><p><b>27.9%</b> worked in elementary occupations in June 2026.</p><p><b>23.8%</b> were service and sales workers, the second-largest group.</p><p><b>2.0 pts lower</b> was the elementary occupations share compared with June 2025.</p></div></section>
      <section className="lfs-table1-chart class-worker"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 3 · By employment arrangement</p><h3>Wage and salary work remains the norm.</h3></div><p>The same employed population is grouped into four main classes. <b>Wage and salary workers include four subcategories</b>, shown beside the chart. Select a main class to trace it across the survey periods.</p></div><TrendChart series={classTrends} active={workerType} onSelect={setWorkerType} yMax={75} legendFooter={<aside className="lfs-wage-breakdown"><header><span>Inside wage &amp; salary</span><strong>64.1%</strong></header><p>June 2026 share of all employed people</p><div className="lfs-wage-stack" aria-label="Wage and salary worker subcategories"><i style={{width:"77.6%"}}/><i style={{width:"15.4%"}}/><i style={{width:"6.7%"}}/><i style={{width:"0.3%"}}/></div><ul><li><i/><span>Private establishment</span><b>49.7%</b></li><li><i/><span>Government or government corporation</span><b>9.9%</b></li><li><i/><span>Private household</span><b>4.3%</b></li><li><i/><span>Paid work in family farm or business</span><b>0.2%</b></li></ul><small>Subcategories may differ slightly from 64.1% because the published figures are rounded.</small></aside>}/><div className="lfs-insight-row"><p><b>64.1%</b> were wage and salary workers in June 2026.</p><p><b>49.7%</b> of all employed people worked for private establishments.</p><p><b>26.9%</b> were self-employed without paid employees.</p></div></section>
    </section>
    <section className="lfs-table2" id="table-2"><div className="lfs-section-head"><div><p className="lfs-kicker">03 · Sectors and working hours</p><h2>Where people work and for how long.</h2></div><p>Look inside the three economic sectors, then see how weekly working time was distributed. Figures are shares of employed people; precision measures are available in the PSA source files.</p></div><div className="lfs-table2-total"><header><span>Working-hours snapshot</span><b>June 2026</b></header><article><strong>69.6%</strong><small>worked 40 hours or more</small></article><article><strong>29.0%</strong><small>worked fewer than 40 hours</small></article><article><strong>40.6</strong><small>mean hours worked in one week</small></article></div>
      <section className="lfs-table2-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 1 · Inside each sector</p><h3>Trade leads services; construction leads industry.</h3></div><p>These percentages describe the composition <b>within the selected sector</b>. Choose a sector and period to see how its employed population was distributed among subsectors.</p></div><div className="lfs-table2-controls"><div>{(["Agriculture","Industry","Services"] as SectorDetail[]).map(item=><button key={item} className={table2Sector===item?"active":""} onClick={()=>setTable2Sector(item)}>{item}</button>)}</div><div>{periods.map(item=><button key={item} className={table2Period===item?"active":""} onClick={()=>setTable2Period(item)}>{item}</button>)}</div></div><div className="lfs-subsector-chart"><header><span>{table2Sector} subsectors</span><b>{table2Period}</b></header>{selectedSubsectors.map((item,i)=>{const value=item.values[table2PeriodIndex];const annual=value-item.values[0];return <article key={item.name}><span>{String(i+1).padStart(2,"0")}</span><strong>{item.name}</strong><div><i style={{width:`${value/maxSubsector*100}%`}}/></div><b>{value.toFixed(1)}%</b><em className={annual<0?"down":""}>{table2Period==="Jun 2025"?"baseline":`${annual>=0?"+":""}${annual.toFixed(1)} pts`}</em></article>})}</div></section>
      <section className="lfs-table2-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 2 · Weekly hours worked</p><h3>About seven in ten worked at least 40 hours.</h3></div><p>The distribution was broadly stable across the five periods. The mean workweek was <b>40.5 hours in June 2025</b> and <b>40.6 hours in June 2026</b>.</p></div><div className="lfs-hours-chart"><div className="lfs-hours-legend"><span><i/>Less than 40 hours</span><span><i/>40 hours or more</span><span><i/>With a job, not at work</span></div>{hoursWorked.map(item=><article key={item.period}><strong>{item.period}</strong><div className="lfs-hours-stack"><i style={{width:`${item.under40}%`}}/><i style={{width:`${item.fortyPlus}%`}}/><i style={{width:`${item.notAtWork}%`}}/></div><span>{item.under40.toFixed(1)}%</span><span>{item.fortyPlus.toFixed(1)}%</span><span>{item.notAtWork.toFixed(1)}%</span><b>{item.mean.toFixed(1)}<small> mean hours</small></b></article>)}<p>“One hour” is included within the “less than 40 hours” category and is not shown as a separate segment.</p></div></section>
      <section className="lfs-table2-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 3 · Why workweeks differ</p><h3>Work schedules explain short weeks; earnings explain long ones.</h3></div><p>Explore the reasons behind unusually short or long workweeks and temporary absence. Choose a worker group and reference period to compare the reported reasons.</p></div><div className="lfs-table2-controls"><div>{(["Under 40 Hours","More Than 48 Hours","Job, Not at Work"] as WorkReasonGroup[]).map(item=><button key={item} className={workReasonGroup===item?"active":""} onClick={()=>setWorkReasonGroup(item)}>{item}</button>)}</div><div>{periods.map(item=><button key={item} className={workReasonPeriod===item?"active":""} onClick={()=>setWorkReasonPeriod(item)}>{item}</button>)}</div></div><div className="lfs-work-reasons"><header><span>Reported reasons · {workReasonGroup}</span><b>{workReasonPeriod}</b></header>{selectedWorkReasons.map((item,i)=>{const value=item.values[workReasonPeriodIndex];const annual=value-item.values[0];return <article key={item.name}><span>{String(i+1).padStart(2,"0")}</span><strong>{item.name}</strong><div><i style={{width:`${value/maxWorkReason*100}%`}}/></div><b>{value.toFixed(1)}%</b><em className={annual<0?"down":""}>{workReasonPeriod==="Jun 2025"?"baseline":`${annual>=0?"+":""}${annual.toFixed(1)} pts`}</em></article>})}<p>Percentages describe reported reasons within the selected group. Categories below 0.05% are omitted from this display; published estimates may not sum exactly because of rounding.</p></div></section>
    </section>
    <section className="lfs-table3" id="table-3"><div className="lfs-section-head"><div><p className="lfs-kicker">04 · Underemployment and unemployment</p><h2>Who needs more work and who is looking for it?</h2></div><p>Focus on two groups facing gaps in work: employed people who wanted more work, and people without work who were available and looking for a job.</p></div><div className="lfs-table3-total"><article><span>Underemployed · June 2026</span><strong>6.11M</strong><small>12.1% of employed people</small></article><article><span>Unemployed · June 2026</span><strong>2.59M</strong><small>4.9% of the labor force</small></article></div>
      <section className="lfs-table3-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 1 · Hours of underemployed workers</p><h3>Under half worked fewer than 40 hours.</h3></div><p>In June 2026, <b>48.9% worked fewer than 40 hours</b> and <b>3.0% did not work</b> during the reference week. Together, these groups made up <b>51.9%</b> of underemployed people; 48.1% worked 40 hours or more.</p></div><div className="lfs-gap-chart"><div className="lfs-gap-legend"><span><i/>Less than 40 hours</span><span><i/>40 hours or more</span><span><i/>Did not work</span></div>{underemploymentHours.map(item=><article key={item.period}><strong>{item.period}</strong><div><i style={{width:`${item.under40}%`}}/><i style={{width:`${item.fortyPlus}%`}}/><i style={{width:`${item.notAtWork}%`}}/></div><span><b>{item.under40.toFixed(1)}%</b> under 40 hours</span><span>{item.fortyPlus.toFixed(1)}% worked 40+</span></article>)}</div></section>
      <section className="lfs-table3-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 2 · Where underemployed people work</p><h3>Services account for most underemployed workers.</h3></div><p>Services accounted for <b>54.7%</b> of underemployed people in June 2026. Agriculture accounted for <b>27.8%</b>, down from 31.5% in June 2025.</p></div><div className="lfs-gap-chart sectors"><div className="lfs-gap-legend"><span><i/>Agriculture</span><span><i/>Industry</span><span><i/>Services</span></div>{underemploymentSectors.map(item=><article key={item.period}><strong>{item.period}</strong><div><i style={{width:`${item.agriculture}%`}}/><i style={{width:`${item.industry}%`}}/><i style={{width:`${item.services}%`}}/></div><span><b>{item.agriculture.toFixed(1)}%</b> agriculture</span><span>{item.services.toFixed(1)}% services</span></article>)}</div></section>
      <section className="lfs-table3-view"><div className="lfs-table1-heading"><div><p className="lfs-kicker">View 3 · Profile of unemployed people</p><h3>Young and early-career adults account for most unemployment.</h3></div><p>This view describes the composition of unemployed people, not unemployment rates within each group. Choose a profile and period to explore the distribution.</p></div><div className="lfs-table2-controls"><div>{(["Age","Sex","Education"] as UnemploymentProfile[]).map(item=><button key={item} className={unemploymentProfile===item?"active":""} onClick={()=>setUnemploymentProfile(item)}>{item}</button>)}</div><div>{periods.map(item=><button key={item} className={table3Period===item?"active":""} onClick={()=>setTable3Period(item)}>{item}</button>)}</div></div><div className="lfs-unemployment-profile"><header><span>Unemployed people by {unemploymentProfile.toLowerCase()}</span><b>{table3Period}</b></header>{selectedUnemploymentProfile.map((item,i)=>{const value=item.values[table3PeriodIndex];return <article key={item.name}><span>{String(i+1).padStart(2,"0")}</span><strong>{item.name}</strong><div><i style={{width:`${value/maxUnemploymentProfile*100}%`}}/></div><b>{value.toFixed(1)}%</b></article>})}</div></section>
      <aside className="lfs-youth-compare"><div><p className="lfs-kicker">Youth comparison · Ages 15–24</p><h3>Youth unemployment was nearly three times the national rate.</h3><p>The profile above shows who makes up the unemployed population. This comparison answers a different question: what share of each labor force was unemployed?</p></div><div className="lfs-youth-rate"><article><span>Youth unemployment rate</span><strong>13.5%</strong><small>977,611 unemployed youth</small></article><i>vs</i><article><span>National unemployment rate</span><strong>4.9%</strong><small>All labor force participants aged 15+</small></article></div></aside>
    </section>
    <section className="lfs-industries" id="industries"><div className="lfs-section-head"><div><p className="lfs-kicker">05 · Employment change by industry</p><h2>Where employment grew and declined.</h2></div><div className="lfs-toggle"><button className={change==="annual"?"active":""} onClick={()=>setChange("annual")}>Annual comparison</button><button className={change==="monthly"?"active":""} onClick={()=>setChange("monthly")}>Monthly comparison</button></div></div><p className="lfs-chart-note"><b>Change in estimated employed people by industry, thousands</b> · June 2026 versus {change==="annual"?"June 2025":"May 2026"}. These are differences between survey estimates; they do not track individual workers moving between industries.</p><div className="lfs-change-chart">{[...industries].sort((a,b)=>b[change]-a[change]).map(d=>{const value=d[change];return <article key={d.name}><strong>{d.name}</strong><div className="lfs-change-track"><i className={value<0?"negative":""} style={{width:`${Math.abs(value)/maxChange*50}%`,left:value<0?`${50-Math.abs(value)/maxChange*50}%`:"50%"}}/></div><b className={value<0?"negative":""}>{value>0?"+":""}{value}K</b></article>})}</div><div className="lfs-zero"><span>Fewer employed</span><i/><span>More employed</span></div></section>
    <LaborGeography />
    <section className="lfs-source" id="source"><div className="lfs-source-intro"><div><p className="lfs-kicker">About the data</p><h2>Sources, methods<br/>&amp; history.</h2></div><p>This dashboard pairs the June 2026 national Labor Force Survey with annual 2025 regional estimates. They describe related labor-market measures, but they do not share the same reference period.</p></div><div className="lfs-source-grid"><article><b>National source</b><a href="https://psa.gov.ph/content/number-employed-persons-increased-5066-million-labor-force-participation-rose-june-2026" target="_blank" rel="noreferrer">PSA June 2026 Labor Force Survey ↗</a><p>Published 6 August 2026 · Reference No. 2026-255.</p></article><article><b>Regional source</b><a href="https://psa.gov.ph/statistics/labor-force-survey/node/1684083111" target="_blank" rel="noreferrer">PSA Annual Provincial Labor Market Statistics 2025 ↗</a><p>Annual 2025 preliminary estimates used in the regional map and comparison chart.</p></article><article><b>Coverage</b><p>National figures cover persons aged 15 years and over. Counts are shown in millions or thousands; rates are shown in percent.</p></article><article><b>Reference periods</b><p>National views center on June 2026, with June 2025 and recent 2026 months for comparison. Regional views compare annual 2024 final and annual 2025 preliminary estimates.</p></article><article className="lfs-source-method"><b>Reading the estimates</b><p>Figures are survey estimates and are rounded for readability. The PSA workbooks provide standard errors and 90% confidence intervals. June 2025 and 2026 estimates use different Census-based population projections.</p></article><article className="lfs-source-history"><b>Dashboard history</b><dl><div><dt>Created</dt><dd>19 August 2026</dd></div><div><dt>Last updated</dt><dd>25 August 2026</dd></div><div><dt>Last reviewed</dt><dd>20 August 2026</dd></div></dl><button type="button" onClick={()=>setShowMaintenanceLog(true)}>View maintenance log</button></article></div></section>
    {showMaintenanceLog&&<div className="lfs-log-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setShowMaintenanceLog(false)}}><section className="lfs-maintenance-log" role="dialog" aria-modal="true" aria-labelledby="lfs-maintenance-title"><header><div><p className="lfs-kicker">Dashboard history</p><h2 id="lfs-maintenance-title">Maintenance Log</h2></div><button type="button" aria-label="Close maintenance log" onClick={()=>setShowMaintenanceLog(false)}>×</button></header><div className="lfs-log-entries"><article className="featured"><time dateTime="2026-08-25">25 August 2026</time><h3>Navigation and documentation update</h3><p>Shortened the section-navigation labels, added dashboard-specific hover and focus states, standardized the DATA badge and back-to-top control, and rebuilt the About section with source, coverage, reference-period, and maintenance information.</p></article><article><time dateTime="2026-08-20">20 August 2026</time><h3>Full data and dashboard review</h3><p>Reconciled the national views with PSA Tables A, 1, 2, 3, B, and C, and checked the regional indicators across all 18 regions. Corrected the underemployment-hours explanation and youth unemployment figures, then reviewed responsive layouts and interactions.</p></article><article><time dateTime="2026-08-20">20 August 2026</time><h3>June release and regional geography added</h3><p>Updated the dashboard from the March release to the June 2026 Labor Force Survey. Added the annual 2025 regional labor-market map and the 2024–2025 regional comparison view, with separate source and reference-period notes.</p></article><article><time dateTime="2026-08-19">19 August 2026</time><h3>Dashboard created</h3><p>Created the first Labor Force Survey dashboard using the March 2026 PSA release, covering national labor-force participation, employment composition, working hours, underemployment, and unemployment.</p></article></div></section></div>}
    <footer className="lfs-footer"><a href="/">← Back to Factbook</a><span>Demographics &amp; Social Development · June 2026</span></footer><a className="lfs-top" href="#top" aria-label="Back to top" title="Back to top">↑</a>
  </main>;
}
