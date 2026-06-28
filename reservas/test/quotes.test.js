'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { computeTotals, round2 } = require('../src/quotes');

test('subtotal sums line totals (qty * unit)', () => {
  const r = computeTotals([
    { label: 'Pacote', qty: 1, unit_price: 350 },
    { label: 'Insufláveis', qty: 2, unit_price: 90 },
  ]);
  assert.equal(r.subtotal, 530);
  assert.equal(r.total, 530);
  assert.equal(r.items[1].line_total, 180);
});

test('percent discount applies to subtotal', () => {
  const r = computeTotals(
    [{ label: 'Pacote', qty: 1, unit_price: 500 }],
    { type: 'percent', value: 10 }
  );
  assert.equal(r.subtotal, 500);
  assert.equal(r.discountAmount, 50);
  assert.equal(r.total, 450);
});

test('fixed discount subtracts a flat amount', () => {
  const r = computeTotals(
    [{ label: 'Pacote', qty: 1, unit_price: 480 }],
    { type: 'fixed', value: 80 }
  );
  assert.equal(r.discountAmount, 80);
  assert.equal(r.total, 400);
});

test('fixed discount is clamped to subtotal (never negative total)', () => {
  const r = computeTotals(
    [{ label: 'Pacote', qty: 1, unit_price: 100 }],
    { type: 'fixed', value: 250 }
  );
  assert.equal(r.discountAmount, 100);
  assert.equal(r.total, 0);
});

test('percent discount is clamped to 0..100', () => {
  const r = computeTotals(
    [{ label: 'X', qty: 1, unit_price: 200 }],
    { type: 'percent', value: 150 }
  );
  assert.equal(r.total, 0);
});

test('none discount leaves subtotal unchanged', () => {
  const r = computeTotals([{ label: 'X', qty: 3, unit_price: 45 }], { type: 'none', value: 0 });
  assert.equal(r.subtotal, 135);
  assert.equal(r.discountAmount, 0);
  assert.equal(r.total, 135);
});

test('rounding to 2 decimals is stable', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  const r = computeTotals(
    [{ label: 'Horas', qty: 3, unit_price: 33.333 }],
    { type: 'percent', value: 12.5 }
  );
  assert.equal(r.subtotal, 100);
  assert.equal(r.total, 87.5);
});
