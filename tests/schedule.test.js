import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDuration,
  entryKey,
  fillEmptyEntries,
  formatMinutes,
  getDayInfo,
  getMonthSummary,
  normalizeEntries
} from '../src/lib/schedule.js';

const period = { month: 8, year: 2026 };
const employees = [{ id: 'sami', name: 'סמי' }, { id: 'rami', name: 'רמי' }];

test('restaurant week rules are correct', () => {
  assert.equal(getDayInfo(2026, 8, 2).closed, true);
  assert.equal(getDayInfo(2026, 8, 7).short, true);
  assert.equal(getDayInfo(2026, 8, 8).saturday, true);
  assert.equal(getDayInfo(2026, 8, 8).closed, false);
});

test('overnight shifts and Friday limits are calculated correctly', () => {
  assert.equal(calculateDuration('19:00', '07:00'), 720);
  assert.equal(calculateDuration('07:00', '17:00', { short: true }), 600);
  assert.equal(calculateDuration('07:00', '19:00', { short: true }), null);
  assert.equal(calculateDuration('07:00', '07:00'), null);
  assert.equal(formatMinutes(750), '12:30');
});

test('smart fill skips Sunday and caps Friday', () => {
  const result = fillEmptyEntries({}, employees, period, null, '07:00', '19:00');
  assert.equal(result.entries[entryKey('sami', 2)], undefined);
  assert.equal(result.entries[entryKey('sami', 7)].end, '17:00');
  assert.equal(result.entries[entryKey('sami', 8)].end, '19:00');
});

test('old data is normalized and totals exclude closed Sundays', () => {
  const source = {
    [entryKey('sami', 2)]: { start: '07:00', end: '19:00', off: false },
    [entryKey('sami', 7)]: { start: '07:00', end: '19:00', off: false }
  };
  const normalized = normalizeEntries(source, employees, period);
  assert.equal(normalized[entryKey('sami', 2)], undefined);
  assert.equal(normalized[entryKey('sami', 7)].end, '17:00');
  const summary = getMonthSummary(normalized, employees, period);
  assert.equal(summary.minutes, 600);
  assert.equal(summary.shifts, 1);
});
