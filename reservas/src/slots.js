'use strict';

/**
 * Turns a segment's slot templates + a day's busy intervals into the list of
 * genuinely free slots a customer may pick.
 *
 * Busy intervals come from Google Calendar free/busy AND from reservations the
 * DB is already holding (so overlapping slots — e.g. "dia inteiro" vs "manhã" —
 * correctly block each other, and it still works in DRY_RUN with no calendar).
 */

const pricing = require('./pricing');

/**
 * Convert a wall-clock date+time in a given IANA timezone to a UTC Date.
 * Handles DST via the standard locale round-trip trick.
 */
function zonedToUTC(dateStr, timeStr, timeZone) {
  const naiveUTC = new Date(`${dateStr}T${timeStr}:00Z`); // interpret as if UTC
  const asTz = new Date(naiveUTC.toLocaleString('en-US', { timeZone }));
  const asUtc = new Date(naiveUTC.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asUtc.getTime() - asTz.getTime();
  return new Date(naiveUTC.getTime() + offsetMs);
}

/** [aStart,aEnd) overlaps [bStart,bEnd) ? (all Date or ms) */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * @param {object} opts
 * @param {string} opts.segment   segment key
 * @param {string} opts.date      'YYYY-MM-DD'
 * @param {Array<{start:string,end:string}>} opts.busy  ISO datetime intervals
 * @returns {Array<{key,label,start,end,startISO,endISO,available:boolean}>}
 */
function computeSlots({ segment, date, busy = [] }) {
  const tz = pricing.timezone;
  const templates = pricing.getSlots(segment);

  const busyIntervals = busy
    .filter((b) => b && b.start && b.end)
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));

  return templates.map((slot) => {
    const start = zonedToUTC(date, slot.start, tz);
    const end = zonedToUTC(date, slot.end, tz);
    const available = !busyIntervals.some((b) => overlaps(start, end, b.start, b.end));
    return {
      key: slot.key,
      label: slot.label,
      start: slot.start,
      end: slot.end,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      available,
    };
  });
}

/** Only the free slots. */
function freeSlots(opts) {
  return computeSlots(opts).filter((s) => s.available);
}

/** Convert a held reservation (segment + date + slot_key) to a busy interval. */
function reservationBusy(segment, date, slotKey) {
  const slot = pricing.getSlot(segment, slotKey);
  if (!slot) return null;
  const tz = pricing.timezone;
  return {
    start: zonedToUTC(date, slot.start, tz).toISOString(),
    end: zonedToUTC(date, slot.end, tz).toISOString(),
  };
}

module.exports = { computeSlots, freeSlots, reservationBusy, zonedToUTC };
