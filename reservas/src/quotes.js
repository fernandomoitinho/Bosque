'use strict';

/**
 * Quote math — pure, dependency-free, the single source of truth for totals.
 * Both the admin builder and the stored quote run through computeTotals().
 */

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * @param {Array<{label:string, qty:number, unit_price:number}>} items
 * @param {object} discount  { type: 'none'|'percent'|'fixed', value: number }
 * @returns {{ items, subtotal, discountAmount, total, discount_type, discount_value }}
 */
function computeTotals(items, discount = { type: 'none', value: 0 }) {
  const normItems = (items || []).map((it) => {
    const qty = Number(it.qty) || 0;
    const unit = Number(it.unit_price) || 0;
    return {
      label: String(it.label || '').trim(),
      qty,
      unit_price: round2(unit),
      line_total: round2(qty * unit),
    };
  });

  const subtotal = round2(normItems.reduce((sum, it) => sum + it.line_total, 0));

  const type = discount && discount.type ? discount.type : 'none';
  const value = Number(discount && discount.value) || 0;

  let discountAmount = 0;
  if (type === 'percent') {
    discountAmount = round2(subtotal * (clamp(value, 0, 100) / 100));
  } else if (type === 'fixed') {
    discountAmount = round2(clamp(value, 0, subtotal));
  }

  const total = round2(Math.max(0, subtotal - discountAmount));

  return {
    items: normItems,
    subtotal,
    discountAmount,
    total,
    discount_type: type,
    discount_value: value,
  };
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

module.exports = { computeTotals, round2 };
