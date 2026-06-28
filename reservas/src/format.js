'use strict';

/** Shared formatting helpers (money, dates) in pt-PT. */

const pricing = require('./pricing');

function money(value, currency = pricing.currency) {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/** 'YYYY-MM-DD' -> '12 de julho de 2026' (pt-PT). */
function longDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  try {
    return new Intl.DateTimeFormat('pt-PT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { money, longDate, escapeHtml };
