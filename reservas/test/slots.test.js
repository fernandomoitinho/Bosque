'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const slots = require('../src/slots');

test('all slots free when no busy intervals', () => {
  const result = slots.computeSlots({ segment: 'kids', date: '2026-07-12', busy: [] });
  assert.ok(result.length >= 1);
  assert.ok(result.every((s) => s.available));
});

test('a busy interval blocks the overlapping slot only', () => {
  // Kids "manha" is 10:00–13:00 Europe/Lisbon. Make it busy.
  const busyInterval = slots.reservationBusy('kids', '2026-07-12', 'manha');
  assert.ok(busyInterval);
  const result = slots.computeSlots({ segment: 'kids', date: '2026-07-12', busy: [busyInterval] });
  const manha = result.find((s) => s.key === 'manha');
  const tarde = result.find((s) => s.key === 'tarde');
  assert.equal(manha.available, false);
  assert.equal(tarde.available, true);
});

test('overlapping templates conflict (dia inteiro blocks manha)', () => {
  // Holding "dia" (10:00–19:00) should make "manha" (10:00–13:00) unavailable.
  const diaBusy = slots.reservationBusy('kids', '2026-07-12', 'dia');
  const result = slots.computeSlots({ segment: 'kids', date: '2026-07-12', busy: [diaBusy] });
  assert.equal(result.find((s) => s.key === 'manha').available, false);
  assert.equal(result.find((s) => s.key === 'tarde').available, false);
});

test('freeSlots returns only available ones', () => {
  const busy = [slots.reservationBusy('business', '2026-07-13', 'deep')];
  const free = slots.freeSlots({ segment: 'business', date: '2026-07-13', busy });
  assert.ok(free.every((s) => s.available));
  assert.ok(!free.some((s) => s.key === 'deep'));
});
