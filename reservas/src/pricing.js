'use strict';

/**
 * Loads and validates data/pricing.json (CMS-lite).
 * Read once at boot; expose small helpers used by routes/slots.
 */

const path = require('path');
const fs = require('fs');

const FILE = path.join(__dirname, '..', 'data', 'pricing.json');

let config;
try {
  config = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (err) {
  throw new Error(`Could not read/parse data/pricing.json: ${err.message}`);
}

if (!config.segments || typeof config.segments !== 'object') {
  throw new Error('pricing.json: missing "segments" object');
}

const SEGMENT_KEYS = Object.keys(config.segments);

function getSegment(segment) {
  return config.segments[segment] || null;
}

/** All slot templates for a segment: [{ key, label, start, end }]. */
function getSlots(segment) {
  const seg = getSegment(segment);
  return seg ? seg.slots : [];
}

function getSlot(segment, slotKey) {
  return getSlots(segment).find((s) => s.key === slotKey) || null;
}

function getPackages(segment) {
  const seg = getSegment(segment);
  return seg ? seg.packages : [];
}

function getPackage(segment, packageId) {
  return getPackages(segment).find((p) => p.id === packageId) || null;
}

module.exports = {
  config,
  currency: config.currency || 'EUR',
  timezone: config.timezone || 'Europe/Lisbon',
  SEGMENT_KEYS,
  getSegment,
  getSlots,
  getSlot,
  getPackages,
  getPackage,
};
