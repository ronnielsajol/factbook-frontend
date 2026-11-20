import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { matches, params, money, emptyFilters, switchMapMode } from '../app/dashboards/dpwh-infrastructure/data.ts';

const origin = process.env.DPWH_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const snapshot = JSON.parse(readFileSync(new URL('../data/generated/dpwh-dashboard.json', import.meta.url)));
const measurements = [];
test('dashboard calculations select the correct year and status without losing zero budgets', () => {
  const selected = snapshot.cells.filter(c => matches(c, { ...emptyFilters, year: '2026' }));
  assert.equal(selected.reduce((sum, c) => sum + c[4], 0), 14964);
  const completed = snapshot.cells.filter(c => matches(c, { ...emptyFilters, status: 'Completed' }));
  assert.equal(completed.reduce((sum, c) => sum + c[4], 0), 213694);
  assert.equal(params(emptyFilters).toString(), '');
  assert.notEqual(money(0), money(null));
});
async function get(path, status = 200) {
  const start = performance.now();
  const response = await fetch(`${origin}/api/dpwh/${path}`);
  assert.equal(response.status, status, path);
  const text = await response.text();
  measurements.push({ request: path, bytes: Buffer.byteLength(text), ms: Math.round(performance.now() - start) });
  assert.ok(Buffer.byteLength(text) < 192 * 1024, 'API response must remain below 192 KiB');
  return JSON.parse(text);
}

test('map distribution counts unique mapped contracts across modes and geography', async () => {
  for (const query of ['', 'region=National%20Capital%20Region', 'region=National%20Capital%20Region&city=1380600000', 'province=CAVITE', 'status=Completed', 'q=zzzznonexistent987654321']) {
    const totals = await get(`map-summary?${query}`);
    for (const colorBy of ['status', 'year', 'type']) {
      const result = await get(`map-distribution?${query}&colorBy=${colorBy}`);
      assert.equal(result.total, totals.mapped);
      assert.equal(result.rows.reduce((sum, row) => sum + row.count, 0), totals.mapped);
      assert.equal(new Set(result.rows.map(row => row.category)).size, result.rows.length);
      if (query === 'status=Completed' && colorBy === 'status') assert.deepEqual(result.rows, [{ category: 'Completed', count: totals.mapped }]);
      const panned = await get(`map-distribution?${query}&colorBy=${colorBy}&bounds=120,14,121,15&zoom=12`);
      assert.deepEqual(panned, result);
    }
  }
  const db = new DatabaseSync(fileURLToPath(new URL('../../backend/storage/app/imports/city-dashboard.sqlite', import.meta.url)), { readOnly: true });
  try {
    const expected = db.prepare('SELECT status AS category, count(DISTINCT c.id) AS count FROM dpwh_contracts c JOIN dpwh_points p ON p.id=c.id GROUP BY status ORDER BY status').all();
    const actual = await get('map-distribution?colorBy=status');
    assert.deepEqual(actual.rows, expected.map(row => ({ ...row })));
  } finally { db.close(); }
  await get('map-distribution?colorBy=invalid', 400);
});

test('overview matches the promoted September 8 snapshot without contract descriptions or points', async () => {
  const result = await get('summary');
  assert.deepEqual(result.totals, snapshot.totals);
  assert.equal(result.cells.reduce((n, r) => n + r[4], 0), 264864);
  assert.equal(result.cells.reduce((n, r) => n + r[5], 0), 651168509291278);
  assert.equal(result.contracts, undefined);
  assert.equal(result.points, undefined);
});

test('all four filters reconcile with the summary cube', async () => {
  for (const filters of [{}, { year: '2026' }, { year: '2024', region: 'Region III', type: 'Flood Control and Drainage', status: 'Completed' }, { year: '2026', type: 'Unclassified', status: 'For Procurement' }]) {
    const result = await get(`contracts?${new URLSearchParams(filters)}`);
    const fields = ['year', 'region', 'type', 'status'];
    const expected = snapshot.cells.filter(c => fields.every((field, i) => !filters[field] || filters[field] === c[i])).reduce((sum, c) => sum + c[4], 0);
    assert.equal(result.total, expected);
    assert.ok(result.rows.length <= 30);
    for (const row of result.rows) for (const [field, value] of Object.entries(filters)) assert.equal(row[field], value);
  }
});

test('search, sorting, pagination and individual profiles', async () => {
  const first = await get('contracts?sort=budget');
  const second = await get('contracts?sort=budget&page=1');
  assert.ok(first.rows.every((r, i, rows) => !i || rows[i - 1].budget_cents >= r.budget_cents));
  assert.ok(first.rows.at(-1).budget_cents >= second.rows[0].budget_cents);
  assert.equal(new Set([...first.rows, ...second.rows].map(r => r.id)).size, 60);
  const chosen = first.rows[0];
  const exact = await get(`contracts?q=${chosen.id}`);
  assert.ok(exact.rows.some(r => r.id === chosen.id));
  const profile = await get(`contract?id=${chosen.id}`);
  assert.equal(profile.budgetCents, chosen.budget_cents);
  assert.equal(profile.components.length, chosen.components);
  assert.equal(profile.amountPaid, undefined);
  const word = await get('contracts?q=flood%20control&year=2024');
  assert.ok(word.total > 0);
  const empty = await get('contracts?q=zzzznonexistent987654321');
  assert.equal(empty.total, 0);
});

test('reconciled additions and corrected years appear in search and profiles', async () => {
  const added = await get('contract?id=24DM0169');
  assert.equal(added.status, 'For Procurement');
  assert.equal(added.budgetCents, 0);
  assert.equal(added.type, 'Unclassified');
  assert.equal(added.components.length, 0);
  assert.equal(added.procurement.abc, '14198650.00');
  const search = await get('contracts?q=24DM0169&year=2024');
  assert.equal(search.rows[0].id, added.id);
  const corrected = await get('contract?id=16CB0121');
  assert.equal(corrected.year, '2017');
  assert.ok(corrected.metadataReconciliation.fields.includes('infraYear'));
  const procurement = await get('contracts?status=For%20Procurement');
  assert.equal(procurement.total, 19164);
});

test('national map reconciles pins; close views are bounded and filterable', async () => {
  const map = await get('map?bounds=116,4,127,22&zoom=5');
  assert.equal(map.clustered, true);
  assert.equal(map.truncated, false);
  assert.equal(map.rows.reduce((sum, r) => sum + r.points, 0), snapshot.totals.mapPoints);
  const close = await get('map?bounds=120,14,122,16&zoom=12&year=2024&status=Completed');
  assert.equal(close.clustered, false);
  assert.ok(close.rows.length <= 600);
  assert.ok(close.rows.every(r => r.status === 'Completed' && r.longitude >= 120 && r.longitude <= 122 && r.latitude >= 14 && r.latitude <= 16));
  assert.equal(close.truncated, true);
});

test('map color modes reconcile every group and return the selected attribute on dots', async () => {
  assert.deepEqual(switchMapMode({ year: '2024', type: 'Roads', status: 'Completed', region: 'Region VII', province: 'CEBU' }), { ...emptyFilters, region: 'Region VII', province: 'CEBU' });
  for (const mode of ['status', 'year', 'type']) {
    const result = await get(`map?colorBy=${mode}&bounds=116,4,127,22&zoom=5`);
    assert.equal(result.colorBy, mode);
    assert.equal(result.rows.reduce((sum, row) => sum + row.points, 0), snapshot.totals.mapPoints);
    for (const row of result.rows) {
      assert.equal(row.mix.length, result.categories.length);
      assert.equal(row.mix.reduce((a, b) => a + b, 0), row.points);
    }
    const db = new DatabaseSync(fileURLToPath(new URL('../../backend/storage/app/imports/city-dashboard.sqlite', import.meta.url)), { readOnly: true });
    const expected = new Map(db.prepare(`SELECT c.${mode} AS category,count(*) AS total FROM dpwh_points p JOIN dpwh_contracts c ON p.id=c.id GROUP BY c.${mode}`).all().map(row => [row.category, row.total]));
    db.close();
    for (const [index, category] of result.categories.entries()) {
      assert.equal(result.rows.reduce((sum, row) => sum + row.mix[index], 0), expected.get(category) ?? 0);
    }
    const dots = await get(`map?colorBy=${mode}&bounds=120,14,122,16&zoom=12`);
    assert.ok(dots.rows.every(row => result.categories.includes(row[mode])));
    await get(`map?colorBy=${mode}&bounds=116,4,127,22&zoom=9`);
  }
  const single = await get('map?colorBy=status&status=Completed&bounds=116,4,127,22&zoom=5');
  const completed = single.categories.indexOf('Completed');
  assert.ok(single.rows.every(row => row.mix[completed] === row.points));
  await get('map?colorBy=bad', 400);
});

test('dedicated map filters use component province labels and preserve distinct contract counts', async () => {
  const options = await get('map-options');
  assert.ok(options.provinces.includes('CEBU'));
  assert.deepEqual(options.provinceRegions.CAVITE, ['Region IV-A']);
  assert.ok(!Object.values(options.provinceRegions).some(regions => regions.includes('National Capital Region')));
  assert.deepEqual(options.provinceRegions.SULU, ['Region IX']);
  const all = await get('map-summary');
  assert.equal(all.contracts, 264864);
  assert.equal(all.mapped, 215728);
  const filters = 'province=CEBU&status=Completed';
  const summary = await get(`map-summary?${filters}`);
  const register = await get(`contracts?${filters}`);
  assert.equal(summary.contracts, register.total);
  assert.ok(summary.mapped > 0 && summary.mapped <= summary.contracts);
  for (const row of register.rows) {
    assert.equal(row.status, 'Completed');
    assert.ok(JSON.parse(row.provinces).includes('CEBU'));
  }
  const map = await get(`map?${filters}&bounds=116,4,127,22&zoom=5`);
  assert.ok(map.rows.length > 0);
  const empty = await get('map-summary?province=CEBU&region=Region%20I');
  assert.equal(empty.contracts, 0);
  await get('map?province=UnknownPlace', 400);
});

test('city and municipality filters identify text locations without moving source pins', async () => {
  const ncr = await get('city-options?region=National%20Capital%20Region');
  assert.equal(ncr.cities.length, 17);
  assert.ok(ncr.cities.some(c => c.name === 'Pateros' && c.kind === 'Municipality'));
  const manila = ncr.cities.find(c => c.name === 'City of Manila');
  assert.equal(manila.province, null);
  const query = `city=${manila.id}&region=National%20Capital%20Region`;
  const results = await get(`contracts?${query}&q=23O00088`);
  assert.equal(results.rows[0].id, '23O00088');
  const summary = await get(`map-summary?${query}`);
  assert.equal(summary.contracts, (await get(`contracts?${query}`)).total);
  const detail = await get('contract?id=23O00088');
  assert.ok(detail.cityMatches.some(c => c.name === 'City of Manila'));
  assert.deepEqual(detail.components[0].coordinates, [122.1020417, 11.9025361]);
  const cebu = await get('city-options?region=Region%20VII&province=CEBU');
  assert.ok(cebu.cities.some(c => c.name === 'Cebu City' && c.kind === 'HUC' && c.province === null));
  assert.equal((await get('city-options')).cities.length, 0);
  await get('contracts?city=invalid', 400);
  await get(`contracts?city=${manila.id}&region=Region%20IV-A`, 400);
});

test('invalid input, missing profiles and SQL-like searches are handled', async () => {
  await get('contracts?year=1900', 400);
  await get('contracts?sort=DROP', 400);
  await get('map?bounds=bad', 400);
  await get('contract?id=../../raw', 400);
  await get('contract?id=NO-SUCH-CONTRACT', 404);
  const literal = await get('contracts?q=%22%20OR%201%3D1%20--');
  assert.equal(literal.total, (await get('contracts?q=OR%201%201')).total);
  assert.ok(literal.total < snapshot.totals.contracts);
  assert.equal((await get('contracts?q=%22%3B--')).total, 0);
  const response = await fetch(`${origin}/api/dpwh/contracts`, { method: 'POST' });
  assert.equal(response.status, 405);
});

test('dashboard route renders the Factbook shell', async () => {
  const response = await fetch(`${origin}/dashboards/dpwh-infrastructure`);
  assert.equal(response.status, 200);
  const html = await response.text();
  for (const text of ['DPWH Infrastructure Projects', 'Factbook', 'Sources, methods', 'View maintenance log', 'Back to Factbook']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('dpwh-contract-components.json'));
  const assets = [...html.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"[^>]*>/g)]
    .map(match => match[1])
    .filter(path => path.startsWith('/') && (path.includes('.css') || (/\/_next\/static\/.*\.js/.test(path))));
  assert.ok(assets.some(path => path.includes('.css')), 'Page must declare stylesheets');
  assert.ok(assets.some(path => (/\/_next\/static\/.*\.js/.test(path))), 'Next.js page must declare its hydration scripts');
  for (const path of new Set(assets)) {
    const asset = await fetch(new URL(path, origin), { headers: { Accept: path.includes('.css') ? 'text/css' : 'text/javascript' } });
    assert.equal(asset.status, 200, `Browser asset: ${path}`);
    assert.match(asset.headers.get('content-type') ?? '', path.includes('.css') ? /text\/css/ : /javascript/);
  }
});

test.after(() => console.log(JSON.stringify({ apiMeasurements: measurements }, null, 2)));

test('dedicated map route renders its own navigation and page title', async () => {
  const response = await fetch(`${origin}/dashboards/dpwh-infrastructure/map`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('DPWH project map'));
  assert.ok(html.includes('Back to dashboard'));
  assert.ok(html.includes('These filters apply only to this map'));
});


test('MIMAROPA combines both source labels consistently without changing national totals', async () => {
  const summary = await get('summary');
  assert.ok(!summary.regions.includes('Region IV-B'));
  assert.equal(summary.regions.filter(r => r === 'MIMAROPA Region').length, 1);
  assert.equal(summary.cells.reduce((sum, c) => sum + c[4], 0), 264864);
  assert.equal(summary.cells.reduce((sum, c) => sum + c[5], 0), 651168509291278);
  const expected = snapshot.cells.filter(c => ['Region IV-B', 'MIMAROPA Region'].includes(c[1])).reduce((sum, c) => sum + c[4], 0);
  for (const region of ['Region IV-B', 'MIMAROPA Region']) {
    const query = `region=${encodeURIComponent(region)}`;
    assert.equal((await get(`contracts?${query}`)).total, expected);
    const totals = await get(`map-summary?${query}`);
    assert.equal(totals.contracts, expected);
    assert.equal((await get(`map-distribution?${query}`)).total, totals.mapped);
  }
});
