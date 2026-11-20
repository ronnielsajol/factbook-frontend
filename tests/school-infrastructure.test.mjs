import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combine,rate,schoolStatus,empty,countLegend} from '../app/dashboards/school-infrastructure/model.ts';
const data=JSON.parse(readFileSync(new URL('../public/data/school-infrastructure/summary.json',import.meta.url)));
const audit=JSON.parse(readFileSync(new URL('../data/qa/deped-school-resources/audit.json',import.meta.url)));
test('national unique-school totals and map/unmapped partition reconcile',()=>{
 const rows=data.filter(r=>r.level==='all'),a=combine(rows);
 assert.equal(a.schools,47818);assert.equal(a.enrollment,23225427);assert.deepEqual(a.gaps,[11497,1888,1828]);
 assert.equal(combine(rows.filter(r=>r.id==='unmapped')).schools,111);
 assert.equal(combine(rows.filter(r=>r.id!=='unmapped')).schools,47707);
 const regions=[...new Set(rows.map(r=>r.region))];assert.equal(regions.reduce((v,region)=>v+combine(rows.filter(r=>r.region===region)).schools,0),47818);
});
test('education filters match independently audited offered-level totals and unknowns',()=>{
 for(const level of ['es','jhs','shs']){
  const a=combine(data.filter(r=>r.level===level));assert.equal(a.schools,audit.utility_by_level[level].offerings);
  ['internet','water','electricity'].forEach((m,i)=>{assert.equal(a.gaps[i],audit.utility_by_level[level][m].False);assert.equal(a.unknown[i],audit.utility_by_level[level][m].missing||0);});
 }
});
test('school status keeps a known gap when another offered level is unknown, and respects level filter',()=>{
 const school={levels:[{level:'es',gaps:['with','without','with']},{level:'jhs',gaps:['unknown','with','without']}]};
 assert.equal(schoolStatus(school,'all',0),'unknown');assert.equal(schoolStatus(school,'es',0),'with');assert.equal(schoolStatus(school,'all',1),'without');
});
test('unknowns are excluded from rate denominator; missing and zero are distinct',()=>{
 const a=empty();a.schools=10;a.gaps[0]=2;a.unknown[0]=2;assert.equal(rate(a,0),25);
 a.unknown[0]=10;assert.equal(rate(a,0),null);a.unknown[0]=0;a.gaps[0]=0;assert.equal(rate(a,0),0);
});
test('all summary groups have unique filter keys, valid counts, and available detail files',()=>{
 const keys=data.map(r=>[r.id,r.region,r.province,r.level].join('|'));assert.equal(new Set(keys).size,keys.length);
 for(const r of data)for(let i=0;i<3;i++){assert.ok(r.gaps[i]+r.unknown[i]<=r.schools);const p=rate(r,i);assert.ok(p===null||p>=0&&p<=100);}
 const geo=JSON.parse(readFileSync(new URL('../public/data/school-infrastructure/boundaries.json',import.meta.url)));
 const ids=new Set(geo.features.map(f=>f.properties.map_id));
 for(const id of new Set(data.map(r=>r.id))){assert.ok(id==='unmapped'||ids.has(id));const details=JSON.parse(readFileSync(new URL(`../public/data/school-infrastructure/${id}.json`,import.meta.url)));assert.equal(details.length,combine(data.filter(r=>r.id===id&&r.level==='all')).schools);}
});
test('facility summaries retain all seven building conditions and classroom level totals',()=>{
 const national=combine(data.filter(r=>r.level==='all'));
 assert.deepEqual(national.buildings.map(b=>b[0]),[96980,103202,96041,22128,1396,1388,6629]);
 const classroomTotals=['es','jhs','shs'].map(level=>combine(data.filter(r=>r.level===level)).rooms[0]);
 assert.deepEqual(classroomTotals,[422455,164281,69624]);
 assert.equal(classroomTotals.reduce((a,b)=>a+b,0),national.rooms[0]);
 for(const id of ['manila-city','unmapped']){const all=combine(data.filter(r=>r.id===id&&r.level==='all'));const byLevel=['es','jhs','shs'].map(level=>combine(data.filter(r=>r.id===id&&r.level===level)));assert.equal(byLevel.reduce((v,r)=>v+r.rooms[0],0),all.rooms[0]);}
});

test('count legend integer ranges agree with every shaded value, including small maxima',()=>{
 for(const max of [1,2,3,5,51,201])for(let value=1;value<=max;value++){
  const i=Math.min(4,Math.ceil(value/max*4));
  const low=Math.floor(max*(i-1)/4)+1,high=Math.floor(max*i/4);
  assert.ok(value>=low&&value<=high);
  assert.notEqual(countLegend(max,i),'No values');
 }
 assert.equal(countLegend(201,1),'1–50 schools');
 assert.equal(countLegend(201,2),'51–100 schools');
 assert.equal(countLegend(1,1),'No values');
 assert.equal(countLegend(1,4),'1 school');
});
