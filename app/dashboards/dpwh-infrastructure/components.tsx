'use client';
import { useEffect, useRef, useState } from 'react';
import { type Contract, type Filters, type Profile, getData, money, number, params, statusColor } from './data';

function date(value: string | null) {
  if (!value) return 'Not reported';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' }).format(parsed);
}

export function useRemote<T>(url: string) {
  const [response, setResponse] = useState<{ url: string; data: T | null; error: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getData<T>(url, controller.signal).then(data => { if (!controller.signal.aborted) setResponse({ url, data, error: '' }); }).catch(e => { if (!controller.signal.aborted) setResponse({ url, data: null, error: e.message }); });
    return () => controller.abort();
  }, [url]);
  return response?.url === url ? response : { data: null, error: '' };
}

export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    ref.current?.showModal(); ref.current?.querySelector('button')?.focus(); document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => { const dialog = ref.current; const close = (event: MouseEvent) => { if (event.target === dialog) onClose(); }; dialog?.addEventListener('click', close); return () => dialog?.removeEventListener('click', close); }, [onClose]);
  return <dialog className={`dpwh-dialog ${wide ? 'dpwh-dialog-wide' : ''}`} ref={ref} aria-labelledby="dpwh-dialog-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><div><p className="dpwh-eyebrow">DPWH · 8 September 2026 snapshot</p><h2 id="dpwh-dialog-title">{title}</h2></div><button onClick={onClose} aria-label="Close dialog">×</button></header><div className="dpwh-dialog-body">{children}</div>
  </dialog>;
}

export function ContractProfile({ id, onClose }: { id: string; onClose: () => void }) {
  const [retry, setRetry] = useState(0);
  const { data, error } = useRemote<Profile>(`/api/dpwh/contract?id=${encodeURIComponent(id)}&retry=${retry}`);
  const linkNames: Record<string, string> = { advertisement: 'Advertisement', contractAgreement: 'Contract agreement', noticeOfAward: 'Notice of award', noticeToProceed: 'Notice to proceed', programOfWork: 'Program of work', engineeringDesign: 'Engineering design' };
  return <Modal title={`Contract ${id}`} onClose={onClose} wide>
    {error ? <p role="alert">{error} <button onClick={() => setRetry(retry + 1)}>Try again</button></p> : !data ? <p role="status">Loading contract…</p> : <>
      <span className="dpwh-status" style={{ '--status': statusColor[data.status] } as React.CSSProperties}>{data.status}</span>
      <h3 className="dpwh-project-title">{data.description}</h3>
      <dl className="dpwh-profile-grid"><div><dt>Reported portal budget</dt><dd>{money(data.budgetCents, false)}</dd></div><div><dt>Reported progress</dt><dd>{data.progress == null ? 'Not reported' : `${data.progress}%`}</dd></div><div><dt>Infrastructure year</dt><dd>{data.year}</dd></div><div><dt>Infrastructure type</dt><dd>{data.type}</dd></div><div><dt>Region</dt><dd>{data.region}</dd></div><div><dt>Contractor</dt><dd>{data.contractor || 'Not reported'}</dd></div><div><dt>Funding source</dt><dd>{data.sourceOfFunds || 'Not reported'}</dd></div><div><dt>Source office / location label</dt><dd>{data.sourceOfficeLabel || 'Not reported'}</dd></div></dl>
      <p className="dpwh-note">Budget is the portal’s reported value, not expenditure. Payment data is unavailable for analysis in this snapshot.</p>
      {data.cityMatches && data.cityMatches.length > 0 && <><h3>City / municipality identified in the text</h3><p className="dpwh-note">Derived from DPWH descriptions; not independently verified from the coordinates.</p><ul>{data.cityMatches.map((place, i) => <li key={i}><strong>{place.name}</strong><p className="dpwh-note">{place.text}</p></li>)}</ul></>}
      <h3>Dates reported by DPWH</h3><dl className="dpwh-profile-grid">{Object.entries({ startDate: 'Start', completionDate: 'Completion', contractEffectivityDate: 'Contract effectivity', expiryDate: 'Expiry' }).map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{date(data.dates[key])}</dd></div>)}</dl>
      <p className="dpwh-note">Dates are reproduced from the portal; no delay assessment is inferred.</p>
      {data.notStartedReason && <p><strong>Not-started reason:</strong> {data.notStartedReason}</p>}
      <h3>Project components <span className="dpwh-muted">({number(data.components.length)})</span></h3>
      <p className="dpwh-note">Coordinates come directly from the DPWH Transparency Portal and are displayed as published. Some may not match the stated project location and have not been independently verified.</p>
      {!data.components.length && <p>No component details were published for this contract.</p>}
      <ol className="dpwh-components">{data.components.map((component, i) => <li key={`${component.id}-${i}`}><p className="dpwh-eyebrow">{component.id}</p><h4>{component.description || component.work || 'Project component'}</h4><p>{[component.type, component.sourceProvince, component.sourceRegion].filter(Boolean).join(' · ')}</p><small>{component.coordinates ? `${component.coordinates[1]}, ${component.coordinates[0]} · ${component.sourceCoordinates?.locationVerified ? 'Source marks location verified' : 'Location not marked verified'}` : 'No usable published coordinates'}</small></li>)}</ol>
      <h3>Source documents</h3><div className="dpwh-documents">{Object.entries(data.documents).filter(([, url]) => /^https?:\/\//.test(url)).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer">{linkNames[name] ?? name} ↗</a>)}</div>
      {!Object.values(data.documents).some(url => /^https?:\/\//.test(url)) && <p>No document links were published for this contract.</p>}
      <p className="dpwh-note">Links open the documents supplied by DPWH; availability may change. Retrieved {date(data.retrievedAt)}.</p>
      {data.metadataReconciliation && <p className="dpwh-note">Year, category or funding metadata was reconciled with the portal on {date(data.metadataReconciliation.reconciledAt)}.</p>}
    </>}
  </Modal>;
}

export function Explorer({ filters, onSelect, mapContext = false }: { filters: Filters; onSelect: (id: string) => void; mapContext?: boolean }) {
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [sort, setSort] = useState('year');
  const [pagination, setPagination] = useState({ key: '', page: 0 }), [retry, setRetry] = useState(0);
  const filterKey = params(filters).toString();
  const pageKey = `${filterKey}|${search}|${sort}`;
  const page = pagination.key === pageKey ? pagination.page : 0;
  const setPage = (value: number) => setPagination({ key: pageKey, page: value });
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 350); return () => clearTimeout(timer); }, [query]);
  const { data: result, error } = useRemote<{ total: number; rows: Contract[] }>(`/api/dpwh/contracts?${filterKey}&q=${encodeURIComponent(search)}&sort=${sort}&page=${page}&retry=${retry}`);
  return <section id="contracts" className="dpwh-section">
    <div className="dpwh-section-heading"><div><p className="dpwh-eyebrow">The contract register</p><h2>Find a project.</h2></div><p>Open a contract for its budget, dates, components and source documents.</p></div>
    <div className="dpwh-search-row"><label>Search contracts<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Project words, contractor, place or contract ID" maxLength={160} /></label><label>Sort by<select value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="year">Infrastructure year · newest first</option><option value="budget">Reported budget · highest first</option><option value="id">Contract ID</option></select></label></div>
    <p className="dpwh-note dpwh-search-help">Search matches the beginning of words and applies to this register. {mapContext ? 'The map filters apply to this list, including contracts without coordinates. Search affects this list only.' : 'The four overview filters also apply to this register.'}</p>
    <div className="dpwh-table-wrap" aria-live="polite" aria-busy={!result && !error}>
      {error ? <div className="dpwh-message" role="alert">{error} <button onClick={() => setRetry(retry + 1)}>Try again</button></div> : !result ? <p className="dpwh-message" role="status">Finding contracts…</p> : !result.total ? <p className="dpwh-message">No contracts match. Try fewer search words or reset the filters.</p> : <table><caption>{number(result.total)} matching contracts · {number(page * 30 + 1)}–{number(Math.min((page + 1) * 30, result.total))}</caption><thead><tr><th scope="col">Contract / infrastructure year</th><th scope="col">Project and location</th><th scope="col">Status</th><th scope="col" className="dpwh-numeric">Reported budget</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.id}><td><button className="dpwh-contract-link" onClick={() => onSelect(row.id)}>{row.id} ↗</button><small>{row.year}</small></td><td><button className="dpwh-project-link" onClick={() => onSelect(row.id)}>{row.description}</button><small>{row.region} · {row.type}{!row.mapped ? ' · No map location' : ''}</small></td><td><span className="dpwh-status" style={{ '--status': statusColor[row.status] } as React.CSSProperties}>{row.status}</span></td><td className="dpwh-numeric" title={money(row.budget_cents, false)}>{money(row.budget_cents)}</td></tr>)}</tbody></table>}
    </div>
    <div className="dpwh-pagination"><button disabled={!page || !result} onClick={() => setPage(page - 1)}>← Previous</button><span>Page {page + 1}{result ? ` of ${Math.max(1, Math.ceil(result.total / 30))}` : ''}</span><button disabled={!result || (page + 1) * 30 >= result.total} onClick={() => setPage(page + 1)}>Next →</button></div>
  </section>;
}

