import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyFilters, regionalSeries } from '../app/dashboards/dpwh-infrastructure/data.ts';
const snapshot = JSON.parse(readFileSync(new URL('../data/generated/dpwh-dashboard.json', import.meta.url)));

test('regional comparison preserves national count and budget across all three modes', () => {
  for (const [mode, categories] of [['status', snapshot.statuses], ['year', snapshot.years], ['type', snapshot.types]]) {
    const counts = regionalSeries(snapshot, mode, categories, emptyFilters, 'count');
    const budgets = regionalSeries(snapshot, mode, categories, emptyFilters, 'budget');
    assert.equal(counts.flatMap(line => line.values).reduce((a, b) => a + b, 0), 264864);
    assert.equal(budgets.flatMap(line => line.values).reduce((a, b) => a + b, 0), 651168509291278);
  }
});
test('regional series uses local secondary filters and keeps every region', () => {
  const filters = { ...emptyFilters, region: 'National Capital Region', year: '2025', type: 'Roads', status: 'Terminated' };
  const series = regionalSeries(snapshot, 'status', ['Completed', 'On-Going'], filters, 'count');
  for (const line of series) for (const [index, region] of snapshot.regions.entries()) {
    const expected = snapshot.cells.filter(c => c[0] === '2025' && c[1] === region && c[2] === 'Roads' && c[3] === line.category).reduce((sum, c) => sum + c[4], 0);
    assert.equal(line.values[index], expected);
  }
  assert.deepEqual(regionalSeries(snapshot, 'status', [], filters, 'count'), []);
});
