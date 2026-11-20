'use client';
import { useState } from 'react';
import { type Snapshot, type ColorMode, type Filters, emptyFilters, colorModeLabel, mapPalette, number, money, regionalSeries } from './data';

const shortRegion = (region: string) => ({ 'National Capital Region': 'NCR', 'Cordillera Administrative Region': 'CAR', 'Negros Island Region': 'NIR', 'MIMAROPA Region': 'MIMAROPA', 'Region XIII': 'Caraga' })[region] ?? region;
export default function RegionalComparison({ snapshot: source, metric, onMetric }: { snapshot: Snapshot; metric: 'count' | 'budget'; onMetric: (metric: 'count' | 'budget') => void }) {
  const order = ['National Capital Region', 'Cordillera Administrative Region', 'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B', 'MIMAROPA Region', 'Region V', 'Region VI', 'Negros Island Region', 'Region VII', 'Region VIII', 'Region IX', 'Region X', 'Region XI', 'Region XII', 'Region XIII', 'Central Office', 'Unknown'];
  const snapshot = { ...source, regions: source.regions.filter(region => region !== 'Central Office' && region !== 'Unknown').sort((a, b) => order.indexOf(a) - order.indexOf(b)) };
  const [mode, setMode] = useState<ColorMode>('status');
  const [selected, setSelected] = useState(['Completed', 'On-Going', 'For Procurement']);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [point, setPoint] = useState<{ category: string; index: number } | null>(null);
  const choices = (field: ColorMode) => field === 'year' ? snapshot.years : field === 'type' ? snapshot.types : snapshot.statuses;
  const series = regionalSeries(snapshot, mode, selected, filters, metric);
  const unassigned = regionalSeries({ ...source, regions: ['Central Office', 'Unknown'] }, mode, selected, filters, 'count');
  const unassignedCounts = [0, 1].map(index => unassigned.reduce((sum, line) => sum + line.values[index], 0));
  const maximum = Math.max(1, ...series.flatMap(line => line.values));
  const step = 10 ** Math.floor(Math.log10(maximum));
  const ceiling = Math.ceil(maximum / step) * step;
  const x = (index: number) => 100 + index * 1060 / Math.max(1, snapshot.regions.length - 1);
  const y = (value: number) => 350 - value / ceiling * 300;
  const fmt = (value: number) => metric === 'count' ? number(value) : money(value);
  const active = point && series.find(line => line.category === point.category);
  return <section className="dpwh-regional" id="regions" aria-labelledby="dpwh-regional-heading">
    <div className="dpwh-regional-heading"><div><h2 id="dpwh-regional-heading">How do regions compare?</h2><p className="dpwh-note">Compare selected categories across all regions. These controls apply only to this comparison.</p></div><div className="dpwh-toggle" aria-label="Regional chart measure"><button aria-pressed={metric === 'count'} onClick={() => onMetric('count')}>Contract count</button><button aria-pressed={metric === 'budget'} onClick={() => onMetric('budget')}>Reported budget</button></div></div>
    <div className="dpwh-regional-controls"><fieldset><legend>Compare by</legend><div className="dpwh-toggle">{(['status', 'year', 'type'] as ColorMode[]).map(field => <button key={field} aria-pressed={mode === field} onClick={() => { setMode(field); setSelected(field === 'status' ? ['Completed', 'On-Going', 'For Procurement'] : field === 'year' ? ['2023', '2024', '2025'] : ['Buildings and Facilities', 'Roads', 'Flood Control and Drainage']); setPoint(null); }}>{colorModeLabel[field]}</button>)}</div></fieldset>{(['status', 'year', 'type'] as ColorMode[]).filter(field => field !== mode).map(field => <label key={field}>{colorModeLabel[field]}<select value={filters[field]} onChange={e => setFilters(current => ({ ...current, [field]: e.target.value }))}><option value="All">All {field === 'status' ? 'statuses' : field === 'year' ? 'years' : 'types'}</option>{choices(field).map(value => <option key={value}>{value}</option>)}</select></label>)}</div>
    <fieldset className="dpwh-regional-series"><legend>Select categories · {selected.length} selected</legend><label><input type="checkbox" checked={selected.length === choices(mode).length} onChange={event => { setSelected(event.target.checked ? [...choices(mode)] : []); setPoint(null); }} /><strong>Select all</strong></label>{choices(mode).map(category => <label key={category}><input type="checkbox" checked={selected.includes(category)} onChange={() => { setSelected(current => current.includes(category) ? current.filter(value => value !== category) : [...current, category]); setPoint(null); }} /><i aria-hidden="true" style={{ background: mapPalette(mode)[category] }} />{category === 'On-Going' ? 'Ongoing' : category}</label>)}</fieldset>
    <p className="dpwh-note">For readability, we recommend showing up to three lines at a time. You can select all categories for a full comparison.</p>
    {!selected.length ? <p className="dpwh-status-empty">Select a category to compare regions.</p> : <>
      <p className="dpwh-regional-readout" aria-live="polite">{active && point ? <><strong>{snapshot.regions[point.index]}</strong> · {active.category}: <strong>{fmt(active.values[point.index])}</strong>{metric === 'count' ? ' contracts' : ' reported budget'}</> : 'Hover, tap, or focus a point to see its exact value.'}</p>
      <div className="dpwh-regional-scroll"><svg viewBox="0 0 1200 465" aria-label={`Regional comparison of ${selected.join(', ')} by ${metric === 'count' ? 'contract count' : 'reported budget'}`}>
        <text x="100" y="22" className="dpwh-axis-title">{metric === 'count' ? 'Contracts' : 'Reported budget'}</text>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1="100" x2="1160" y1={y(ceiling * tick / 4)} y2={y(ceiling * tick / 4)} stroke="#ddd4ca" strokeDasharray="4 6" /><text x="88" y={y(ceiling * tick / 4) + 4} textAnchor="end">{metric === 'count' ? new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(ceiling * tick / 4) : money(ceiling * tick / 4)}</text></g>)}
        {snapshot.regions.map((region, index) => <text key={region} transform={`translate(${x(index)},374) rotate(40)`} textAnchor="start">{shortRegion(region)}</text>)}
        {series.map(line => <g key={line.category}><polyline fill="none" stroke={mapPalette(mode)[line.category]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={line.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} />{line.values.map((value, index) => <circle key={snapshot.regions[index]} cx={x(index)} cy={y(value)} r="3" fill={mapPalette(mode)[line.category]} stroke="white" strokeWidth="1" tabIndex={0} role="button" aria-label={`${snapshot.regions[index]}, ${line.category}: ${fmt(value)} ${metric === 'count' ? 'contracts' : 'reported budget'}`} onMouseEnter={() => setPoint({ category: line.category, index })} onFocus={() => setPoint({ category: line.category, index })} onClick={() => setPoint({ category: line.category, index })} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPoint({ category: line.category, index }); } }} />)}</g>)}
        <text x="630" y="456" textAnchor="middle" className="dpwh-axis-title">Region</text>
      </svg></div>
      <div className="dpwh-regional-unassigned"><h3>Contracts not assigned to a geographic region</h3><p>For the selected categories and filters: <strong>Central Office: {number(unassignedCounts[0])}</strong> · <strong>Unknown: {number(unassignedCounts[1])}</strong></p><p className="dpwh-note">Excluded from the regional lines; retained in dashboard totals and the contract register.</p></div>
      <details className="dpwh-regional-table"><summary>View exact values</summary><div className="dpwh-table-wrap"><table><caption>{metric === 'count' ? 'Contract count' : 'Reported budget'} by region</caption><thead><tr><th scope="col">Region</th>{series.map(line => <th scope="col" key={line.category}>{line.category}</th>)}</tr></thead><tbody>{snapshot.regions.map((region, index) => <tr key={region}><th scope="row">{region}</th>{series.map(line => <td key={line.category}>{metric === 'budget' ? money(line.values[index], false) : number(line.values[index])}</td>)}</tr>)}</tbody></table></div></details>
    </>}
    <p className="dpwh-note">Includes contracts with and without map coordinates, using DPWH’s reported region labels. Statuses reflect the September 2026 snapshot; 2026 figures reflect records available before the year ended and are not final full-year totals.{metric === 'budget' ? ' Reported budgets are not actual spending.' : ''}</p>
  </section>;
}
