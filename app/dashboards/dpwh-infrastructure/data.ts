export type Filters = { year: string; region: string; type: string; status: string; province?: string; city?: string };
export const emptyFilters: Filters = { year: 'All', region: 'All', type: 'All', status: 'All' };
export type Cell = [string, string, string, string, number, number, number, number, number];
export type Snapshot = {
  years: string[]; regions: string[]; types: string[]; statuses: string[]; cells: Cell[];
  detailRetrievalRange: string[]; regionBounds: Record<string, [number, number, number, number]>;
};
export type Contract = { id: string; description: string; year: string; region: string; type: string; status: string; budget_cents: number | null; contractor: string | null; components: number; mapped: number };
export type Component = { id: string; description: string; work: string; type: string | null; sourceProvince: string | null; sourceRegion: string | null; coordinates: number[] | null; coordinateStatus: string; sourceCoordinates: { locationVerified?: boolean } | null };
export type Profile = {
  id: string; description: string; year: string; region: string; type: string; status: string; budgetCents: number | null;
  contractor: string | null; progress: number | null; typeSource: string; componentTypes: string[];
  sourceCategory: string | null; sourceOfficeLabel: string | null; sourceOfFunds: string | null; program: string | null;
  dates: Record<string, string | null>; documents: Record<string, string>; components: Component[];
  procurement: { abc?: string; awardAmount?: string } | null; retrievedAt: string; notStartedReason: string | null;
  cityMatches?: { name: string; rule: string; text: string; componentId?: string }[];
  metadataReconciliation?: { fields: string[]; source: string; reconciledAt: string };
};
export const number = (value: number) => new Intl.NumberFormat('en-PH').format(value);
export function money(value: number | null, compact = true) {
  if (value === null) return 'Not reported';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 2 : 2 }).format(value / 100);
}
export function matches(c: Cell, f: Filters, omit?: keyof Filters) {
  return (['year', 'region', 'type', 'status'] as const).every((field, i) => field === omit || f[field] === 'All' || c[i] === f[field]);
}
export const params = (f: Filters) => new URLSearchParams(Object.entries(f).filter(([, v]) => v !== 'All'));
export const statusColor: Record<string, string> = { Completed: '#287348', 'On-Going': '#b85620', 'For Procurement': '#805568', 'Not Yet Started': '#276fa5', Terminated: '#b23b45' };
export async function getData<T>(url: string, signal?: AbortSignal): Promise<T> {
  // Version cache keys so a promoted snapshot cannot reuse responses from its baseline.
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}snapshot=2026-09-08&revision=2026-09-09-qa`, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data ? String(data.error) : 'Data could not be loaded.');
  return data as T;
}

// Type colors are shared by the annual stacks, legend and type comparison bars.
export const typeColor: Record<string, string> = {
  'Buildings and Facilities': '#b9683f',
  Roads: '#59758b',
  'Flood Control and Drainage': '#528477',
  Bridges: '#805568',
  'Water Provision and Storage': '#819eaf',
  'Septage and Sewerage Plants': '#a18a43',
  Unclassified: '#96938b',
};

export type ColorMode = 'status' | 'year' | 'type';
export const colorModeLabel: Record<ColorMode, string> = { status: 'Status', year: 'Year', type: 'Infrastructure type' };
export const yearColor: Record<string, string> = {
  '2016': '#ede2c0', '2017': '#d6c58f', '2018': '#bca36b', '2019': '#a08050',
  '2020': '#89633f', '2021': '#b67b5d', '2022': '#a0543f', '2023': '#804637',
  '2024': '#6d566a', '2025': '#565477', '2026': '#343b60',
};
export const mapPalette = (mode: ColorMode) => mode === 'status' ? statusColor : mode === 'year' ? yearColor : typeColor;
export const switchMapMode = (filters: Filters): Filters => ({ ...filters, status: 'All', year: 'All', type: 'All' });

export function regionalSeries(snapshot: Snapshot, mode: ColorMode, categories: string[], filters: Filters, metric: 'count' | 'budget') {
  const field = mode === 'year' ? 0 : mode === 'type' ? 2 : 3;
  const rows = snapshot.cells.filter(cell => matches(cell, { ...filters, region: 'All', [mode]: 'All' }));
  return categories.map(category => ({ category, values: snapshot.regions.map(region => rows.reduce((sum, cell) => sum + (cell[1] === region && cell[field] === category ? Number(cell[metric === 'count' ? 4 : 5]) : 0), 0)) }));
}
