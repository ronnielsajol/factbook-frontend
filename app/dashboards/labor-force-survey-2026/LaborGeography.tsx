"use client";
import { useMemo, useState } from "react";
import boundaries from "../../../data/generated/philippines-provinces-simplified.json";
import MapboxChoropleth, { type MapFeature } from "../philippine-electorate/MapboxChoropleth";

type Metric="lfpr"|"employment"|"unemployment"|"underemployment";
type Region={key:string;name:string;lfpr:number[];employment:number[];unemployment:number[];underemployment:number[];se:Record<Metric,number>};
type Boundary={properties:{region?:string};geometry:unknown};
const TOKEN="pk.eyJ1IjoibWFyZ2FyaXRhcml2ZXJhIiwiYSI6IndwLWwtM3cifQ.gj37oGPLjnfI2-zr-b3P5w";
const labels:Record<Metric,string>={lfpr:"Labor-force participation",employment:"Employment",unemployment:"Unemployment",underemployment:"Underemployment"};
const levelColors=["#d7ecec","#b5dadd","#83c1c7","#4b9ba6","#176c79"];
const metricLevels:Record<Metric,{max:number;label:string;color:string}[]>={
 lfpr:[{max:62,label:"Below 62%",color:levelColors[0]},{max:64,label:"62–63.9%",color:levelColors[1]},{max:66,label:"64–65.9%",color:levelColors[2]},{max:70,label:"66–69.9%",color:levelColors[3]},{max:Infinity,label:"70% and above",color:levelColors[4]}],
 employment:[{max:95,label:"Below 95%",color:levelColors[0]},{max:96,label:"95–95.9%",color:levelColors[1]},{max:96.5,label:"96–96.4%",color:levelColors[2]},{max:97,label:"96.5–96.9%",color:levelColors[3]},{max:Infinity,label:"97% and above",color:levelColors[4]}],
 unemployment:[{max:3,label:"Below 3%",color:levelColors[0]},{max:3.5,label:"3–3.4%",color:levelColors[1]},{max:4,label:"3.5–3.9%",color:levelColors[2]},{max:5,label:"4–4.9%",color:levelColors[3]},{max:Infinity,label:"5% and above",color:levelColors[4]}],
 underemployment:[{max:7,label:"Below 7%",color:levelColors[0]},{max:12,label:"7–11.9%",color:levelColors[1]},{max:15,label:"12–14.9%",color:levelColors[2]},{max:20,label:"15–19.9%",color:levelColors[3]},{max:Infinity,label:"20% and above",color:levelColors[4]}],
};
const definitions:Record<Metric,string>={lfpr:"People aged 15+ who are working or actively looking for work, as a share of the population aged 15+.",employment:"Employed people as a share of the labor force.",unemployment:"People without work who are available and actively looking, as a share of the labor force.",underemployment:"Employed people who want more hours or another job, as a share of employed people."};
const national:Record<Metric,number>={lfpr:64.1,employment:95.8,unemployment:4.2,underemployment:11.9};
const regions:Region[]=[
{key:"NCR",name:"National Capital Region",lfpr:[63.475,63.261],employment:[95.160,94.839],unemployment:[4.840,5.161],underemployment:[6.983,6.061],se:{lfpr:.268,employment:.158,unemployment:.158,underemployment:.312}},
{key:"CAR",name:"Cordillera Administrative Region",lfpr:[64.995,63.789],employment:[97.499,97.289],unemployment:[2.501,2.711],underemployment:[12.902,11.748],se:{lfpr:.442,employment:.173,unemployment:.173,underemployment:.700}},
{key:"I",name:"Ilocos Region",lfpr:[64.636,65.336],employment:[96.085,96.170],unemployment:[3.915,3.830],underemployment:[10.229,12.126],se:{lfpr:.556,employment:.283,unemployment:.283,underemployment:.733}},
{key:"II",name:"Cagayan Valley",lfpr:[64.544,64.182],employment:[97.459,96.920],unemployment:[2.541,3.080],underemployment:[11.212,14.501],se:{lfpr:.511,employment:.245,unemployment:.245,underemployment:1.047}},
{key:"III",name:"Central Luzon",lfpr:[63.693,63.353],employment:[97.183,96.681],unemployment:[2.817,3.319],underemployment:[7.375,8.987],se:{lfpr:.482,employment:.184,unemployment:.184,underemployment:.805}},
{key:"CALABARZON",name:"CALABARZON",lfpr:[63.087,63.440],employment:[94.354,94.158],unemployment:[5.646,5.842],underemployment:[15.135,12.532],se:{lfpr:.386,employment:.233,unemployment:.233,underemployment:.735}},
{key:"MIMAROPA",name:"MIMAROPA Region",lfpr:[64.596,64.623],employment:[96.098,95.211],unemployment:[3.902,4.789],underemployment:[19.827,22.019],se:{lfpr:.447,employment:.251,unemployment:.251,underemployment:1.020}},
{key:"V",name:"Bicol Region",lfpr:[59.257,59.006],employment:[94.798,95.259],unemployment:[5.202,4.741],underemployment:[19.648,19.942],se:{lfpr:.455,employment:.255,unemployment:.255,underemployment:1.122}},
{key:"VI",name:"Western Visayas",lfpr:[63.842,64.013],employment:[96.443,96.079],unemployment:[3.557,3.921],underemployment:[11.202,17.201],se:{lfpr:.459,employment:.217,unemployment:.217,underemployment:.943}},
{key:"NIR",name:"Negros Island Region",lfpr:[64.469,63.721],employment:[96.590,96.117],unemployment:[3.410,3.883],underemployment:[5.779,5.616],se:{lfpr:.671,employment:.289,unemployment:.289,underemployment:.491}},
{key:"VII",name:"Central Visayas",lfpr:[64.701,63.910],employment:[96.897,96.212],unemployment:[3.103,3.788],underemployment:[7.048,6.304],se:{lfpr:.562,employment:.242,unemployment:.242,underemployment:.589}},
{key:"VIII",name:"Eastern Visayas",lfpr:[63.620,60.535],employment:[97.221,96.139],unemployment:[2.779,3.861],underemployment:[16.233,13.469],se:{lfpr:.461,employment:.302,unemployment:.302,underemployment:.768}},
{key:"IX",name:"Zamboanga Peninsula",lfpr:[62.371,61.351],employment:[97.492,96.596],unemployment:[2.508,3.404],underemployment:[9.688,13.635],se:{lfpr:.505,employment:.238,unemployment:.238,underemployment:1.131}},
{key:"X",name:"Northern Mindanao",lfpr:[66.210,64.757],employment:[96.229,96.344],unemployment:[3.771,3.656],underemployment:[16.371,17.125],se:{lfpr:.483,employment:.182,unemployment:.182,underemployment:1.188}},
{key:"XI",name:"Davao Region",lfpr:[64.474,65.429],employment:[96.816,97.138],unemployment:[3.184,2.862],underemployment:[4.418,3.883],se:{lfpr:.416,employment:.204,unemployment:.204,underemployment:.230}},
{key:"XII",name:"SOCCSKSARGEN",lfpr:[69.094,67.962],employment:[97.320,96.731],unemployment:[2.680,3.269],underemployment:[30.660,25.030],se:{lfpr:.587,employment:.237,unemployment:.237,underemployment:1.290}},
{key:"XIII",name:"Caraga",lfpr:[70.508,68.706],employment:[96.852,96.437],unemployment:[3.148,3.563],underemployment:[13.362,13.803],se:{lfpr:.474,employment:.189,unemployment:.189,underemployment:.729}},
{key:"BARMM",name:"BARMM",lfpr:[73.459,73.462],employment:[97.016,96.072],unemployment:[2.984,3.928],underemployment:[11.659,12.594],se:{lfpr:.710,employment:.262,unemployment:.262,underemployment:1.097}}];

function RegionalTrend({metric,onMetricChange}:{metric:Metric;onMetricChange:(metric:Metric)=>void}){
 const[hoveredIndex,setHoveredIndex]=useState<number|null>(null);
 const width=1400,height=500,left=74,right=28,top=62,bottom=112,plotW=width-left-right,plotH=height-top-bottom;
 const all=regions.flatMap(r=>r[metric]),rawMin=Math.min(...all),rawMax=Math.max(...all),pad=Math.max((rawMax-rawMin)*.14,1),min=Math.max(0,Math.floor((rawMin-pad)/5)*5),max=Math.ceil((rawMax+pad)/5)*5;
 const x=(i:number)=>left+i*(plotW/(regions.length-1)),y=(v:number)=>top+(max-v)/(max-min)*plotH;
 const path=(year:0|1)=>regions.map((r,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(r[metric][year]).toFixed(1)}`).join(" ");
 const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4),metrics=Object.keys(labels)as Metric[];
 const hoveredRegion=hoveredIndex===null?null:regions[hoveredIndex],cardW=250,cardX=hoveredIndex===null?0:Math.min(Math.max(x(hoveredIndex)-cardW/2,left),width-right-cardW);
 return <div className="lfs-geo-trend"><div className="lfs-geo-trend-head"><div><p className="lfs-kicker">Regional comparison</p><h3>How regional labor-market rates changed.</h3><p>Select an indicator to compare every region’s annual 2024 and 2025 rates. The 2024 figures are final; the 2025 figures are preliminary.</p></div><div className="lfs-geo-year-legend"><span><i className="previous"/>2024</span><span><i/>2025</span></div></div><div className="lfs-geo-tabs lfs-geo-chart-tabs" aria-label="Select line-graph measure">{metrics.map(k=><button key={k} className={metric===k?"active":""} aria-pressed={metric===k} onClick={()=>onMetricChange(k)}>{labels[k]}</button>)}</div><div className="lfs-geo-chart-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${labels[metric]} rates by region in 2024 and 2025`} onMouseLeave={()=>setHoveredIndex(null)}>
 {ticks.map(t=><g key={t}><line x1={left} x2={width-right} y1={y(t)} y2={y(t)} className="grid"/><text x={left-18} y={y(t)+5} textAnchor="end">{t.toFixed(0)}%</text></g>)}
 <path d={path(0)} className="trend previous"/><path d={path(1)} className="trend current"/>
 {regions.flatMap((r,i)=>([0,1]as const).map(year=><circle key={`${r.key}-${year}`} cx={x(i)} cy={y(r[metric][year])} r={year?5:4} className={year?"point current":"point previous"}><title>{`${r.name}: ${r[metric][year].toFixed(1)}% (${year?"2025 preliminary":"2024 final"})`}</title></circle>))}
 {regions.map((r,i)=><rect key={`hit-${r.key}`} x={x(i)-plotW/(regions.length-1)/2} y={top} width={plotW/(regions.length-1)} height={plotH} className="region-hit" onMouseEnter={()=>setHoveredIndex(i)}/>)}
 {hoveredRegion&&<g className="trend-tooltip" transform={`translate(${cardX} ${top+12})`}><rect width={cardW} height="112"/><text x="18" y="27" className="tooltip-region">{hoveredRegion.name}</text><line x1="18" x2={cardW-18} y1="39" y2="39"/><circle cx="21" cy="62" r="5" className="previous"/><text x="36" y="67">2024</text><text x={cardW-18} y="67" textAnchor="end" className="tooltip-value">{hoveredRegion[metric][0].toFixed(1)}%</text><circle cx="21" cy="91" r="5" className="current"/><text x="36" y="96">2025</text><text x={cardW-18} y="96" textAnchor="end" className="tooltip-value">{hoveredRegion[metric][1].toFixed(1)}%</text></g>}
 {regions.map((r,i)=><text key={r.key} x={x(i)} y={height-bottom+34} textAnchor="end" transform={`rotate(-42 ${x(i)} ${height-bottom+34})`} className="region-label">{r.key}</text>)}
 <text x={left} y={24} className="axis-title">Rate (%)</text></svg></div></div>;
}

export default function LaborGeography(){
 const[metric,setMetric]=useState<Metric>("unemployment"),[selected,setSelected]=useState<string|null>(null),[hovered,setHovered]=useState<string|null>(null);
 const active=regions.find(r=>r.key===(hovered??selected))??null;
 const ranked=useMemo(()=>[...regions].sort((a,b)=>b[metric][1]-a[metric][1]),[metric]);
 const levels=metricLevels[metric];
 const levelFor=(value:number)=>levels.find(level=>value<level.max)??levels[levels.length-1];
 const lookup=new Map(regions.map(r=>[r.key,r]));
 const features=(boundaries.features as Boundary[]).map((f,i)=>{const r=lookup.get(f.properties.region??"");return{type:"Feature",id:i,geometry:f.geometry,properties:{recordId:r?.key??`unmatched-${i}`,eyebrow:"Region",label:r?.name??"No regional estimate",value:r?.[metric][1]??0,share:r?.[metric][1]??0,fill:r?levelFor(r[metric][1]).color:"#e7ece9",opacity:r?1:.25}}as MapFeature});
 const value=active?.[metric][1]??0,change=active?value-active[metric][0]:0,rank=active?ranked.findIndex(r=>r.key===active.key)+1:0;
 return <section className="lfs-geography" id="geography"><div className="lfs-section-head lfs-geo-heading"><div><p className="lfs-kicker">06 · Annual 2025 geography</p><h2>Labor markets differ across the country.</h2><p>The June results above describe one month nationally. This separate view uses <b>annual 2025 preliminary estimates</b> to compare regions.</p></div><dl className="lfs-geo-defs">{(Object.keys(labels)as Metric[]).map(k=><div key={k}><dt>{labels[k]}</dt><dd>{definitions[k]}</dd></div>)}</dl></div>
 <div className="lfs-geo-tabs" aria-label="Select labor-market measure">{(Object.keys(labels)as Metric[]).map(k=><button key={k} className={metric===k?"active":""} aria-pressed={metric===k} onClick={()=>setMetric(k)}>{labels[k]}</button>)}</div>
 <div className="lfs-geo-grid"><div className="lfs-geo-map mapbox-map"><MapboxChoropleth accessToken={TOKEN} ariaLabel={`${labels[metric]} by region, annual 2025`} features={features} selectedId={hovered??selected} onHover={h=>setHovered(h?regions.find(r=>r.name===h.label)?.key??null:null)} onSelect={setSelected} onClear={()=>setSelected(null)}/><div className="lfs-geo-legend levels" aria-label={`${labels[metric]} rate ranges`}><strong>{labels[metric]} rate</strong><div>{levels.map(level=><span key={level.label}><i style={{backgroundColor:level.color}}/><b>{level.label}</b></span>)}</div></div></div>
 <aside className="lfs-geo-panel">{active?<><p className="lfs-kicker">{hovered?"Viewing":"Selected region"}</p><h3>{active.name}</h3><article><span>{labels[metric]} rate</span><strong>{value.toFixed(1)}%</strong><small>Annual 2025 preliminary estimate</small></article><dl><div><dt>National rate</dt><dd>{national[metric].toFixed(1)}%</dd></div><div><dt>Change from 2024</dt><dd className={change<0?"down":""}>{change>=0?"+":""}{change.toFixed(1)} pts</dd></div><div><dt>Regional rank</dt><dd>{rank} of {regions.length}</dd></div><div><dt>Standard error</dt><dd>±{active.se[metric].toFixed(1)} pts</dd></div></dl><p>Rank is highest to lowest for the selected indicator. Read the rate and its context together.</p></>:<div className="lfs-geo-empty"><p className="lfs-kicker">Explore the map</p><h3>Select a region.</h3><p>Hover to preview its annual 2025 rate. Click a region to keep its details in view.</p></div>}</aside></div>
 <div className="lfs-geo-rank"><span>Highest regional rates</span>{ranked.slice(0,3).map((r,i)=><article key={r.key}><i>{String(i+1).padStart(2,"0")}</i><b>{r.name}</b><strong>{r[metric][1].toFixed(1)}%</strong></article>)}</div>
 <RegionalTrend metric={metric} onMetricChange={setMetric}/>
 <p className="lfs-geo-note"><b>Different reference period:</b> These are annual 2025 estimates, not a geographic breakdown of June 2026. Provincial and city estimates are available in the source tables and generally carry greater sampling uncertainty. <a href="https://psa.gov.ph/statistics/labor-force-survey/node/1684083111" target="_blank" rel="noreferrer">View the PSA annual provincial release ↗</a></p></section>;
}
