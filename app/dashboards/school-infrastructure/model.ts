export type Summary = { id:string; region:string; province:string; level:string; schools:number; enrollment:number; gaps:number[]; unknown:number[]; anyUnknown:number[]; rooms:number[]; buildings:number[][]; toilets:number[] };
export type School = {id:string;name:string;region:string;province:string;municipality:string;barangay:string;levels:{level:string;enrollment:number|null;gaps:string[];rooms:number|null}[]};
export const empty = (id=''):Summary=>({id,region:'',province:'',level:'',schools:0,enrollment:0,gaps:[0,0,0],unknown:[0,0,0],anyUnknown:[0,0,0],rooms:[0,0,0],buildings:[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],toilets:[0,0,0]});
export function combine(rows:Summary[],id='') { const a=empty(id); for(const r of rows){a.schools+=r.schools;a.enrollment+=r.enrollment;for(const k of ['gaps','unknown','anyUnknown','rooms','toilets'] as const)r[k].forEach((v,i)=>a[k][i]+=v);r.buildings.forEach((v,i)=>v.forEach((n,j)=>a.buildings[i][j]+=n));}return a; }
export function rate(a:Summary,metric:number){const n=a.schools-a.unknown[metric];return n?100*a.gaps[metric]/n:null;}
export function schoolStatus(s:School,level:string,metric:number){const rows=s.levels.filter(r=>level==='all'||r.level===level);return rows.some(r=>r.gaps[metric]==='without')?'without':rows.some(r=>r.gaps[metric]==='unknown')?'unknown':'with';}

// Integer ranges match ceil(value / max * 4), including small filtered maxima.
export function countLegend(max:number,index:number){
 if(index===0)return 'None';
 const low=Math.floor(max*(index-1)/4)+1,high=Math.floor(max*index/4);
 return low>high?'No values':low===high?`${low} school${low===1?'':'s'}`:`${low}–${high} schools`;
}
