'use client';
import { useState } from 'react';
import { useRemote } from '../components';
import { type ColorMode, type Filters, colorModeLabel, mapPalette, number, params } from '../data';

export default function Distribution({ filters, colorBy, unmapped }: { filters: Filters; colorBy: ColorMode; unmapped: number | null }) {
  const [open, setOpen] = useState(true);
  const [retry, setRetry] = useState(0);
  const { data, error } = useRemote<{ total: number; rows: { category: string; count: number }[] }>(`/api/dpwh/map-distribution?${params(filters)}&colorBy=${colorBy}&revision=2&retry=${retry}`);
  const rows = data?.rows.slice().sort((a, b) => colorBy === 'year' ? a.category.localeCompare(b.category) : b.count - a.count) ?? [];
  const segments = rows.map((row, index) => {
    const start = rows.slice(0, index).reduce((sum, item) => sum + item.count, 0) / (data?.total || 1) * 100;
    const end = start + row.count / (data?.total || 1) * 100;
    return `${mapPalette(colorBy)[row.category] ?? '#70655d'} ${start}% ${end}%`;
  });
  return <aside className="dpwh-distribution" aria-label="Mapped contract distribution">
    <button className="dpwh-distribution-toggle" aria-expanded={open} aria-controls="map-distribution-content" onClick={() => setOpen(!open)}><span>Distribution <small>By {colorModeLabel[colorBy].toLowerCase()}</small></span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
    <div id="map-distribution-content" hidden={!open}>
      <p className="dpwh-note">Mapped contracts in your selection</p>
      {error ? <p role="alert">{error} <button onClick={() => setRetry(retry + 1)}>Try again</button></p> : !data ? <p role="status">Updating distribution…</p> : !data.total ? <p role="status">No contracts with map locations match these filters.</p> : <>
        <div className="dpwh-donut" style={{ background: `conic-gradient(${segments.join(',')})` }} role="img" aria-label={`${number(data.total)} mapped contracts; category counts and shares are listed below.`}><div><strong>{number(data.total)}</strong><span>mapped contracts</span></div></div>
        <ul className="dpwh-distribution-legend">{rows.map(row => {
          const share = row.count / data.total * 100;
          const percentage = share < 0.1 ? '<0.1%' : `${share.toFixed(1)}%`;
          return <li key={row.category}><i aria-hidden="true" style={{ background: mapPalette(colorBy)[row.category] ?? '#70655d' }} /><span>{row.category === 'On-Going' ? 'Ongoing' : row.category}<small>{number(row.count)} contracts</small></span><strong>{percentage}</strong></li>;
        })}</ul>
      </>}
      {data && unmapped !== null && unmapped > 0 && <p className="dpwh-distribution-excluded" role="status"><strong>{number(unmapped)} matching {unmapped === 1 ? 'contract has' : 'contracts have'} no published coordinates</strong> and {unmapped === 1 ? 'is' : 'are'} excluded from this chart.</p>}
    </div>
  </aside>;
}
