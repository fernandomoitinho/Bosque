'use strict';

/**
 * Google Calendar integration (googleapis OAuth2).
 *
 * Uses a stored refresh token for offline access against a dedicated
 * "Bosque Reservas" calendar (GOOGLE_CALENDAR_ID). All reservations are tracked
 * as events on that calendar:
 *   - new request        -> tentative event (holds the slot)
 *   - quote accepted      -> event confirmed (status: confirmed)
 *   - request declined    -> event deleted (frees the slot)
 *
 * When DRY_RUN=1 or credentials are missing, calendar calls are no-ops that log,
 * so the UI/flow can be developed without live Google access.
 */

const pricing = require('./pricing');
const { zonedToUTC } = require('./slots');

const DRY_RUN =
  process.env.DRY_RUN === '1' ||
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_REFRESH_TOKEN;

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const TZ = pricing.timezone;

let calendarClient = null;

function getClient() {
  if (DRY_RUN) return null;
  if (calendarClient) return calendarClient;
  // Lazy-require so the app still boots in DRY_RUN without googleapis installed.
  const { google } = require('googleapis');
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  calendarClient = google.calendar({ version: 'v3', auth: oauth2 });
  return calendarClient;
}

/**
 * Busy intervals for a single day, from the Bosque calendar.
 * @returns {Promise<Array<{start:string,end:string}>>} ISO intervals
 */
async function getDayBusy(dateStr) {
  if (DRY_RUN) {
    console.log(`[calendar:DRY_RUN] getDayBusy(${dateStr}) -> []`);
    return [];
  }
  const cal = getClient();
  const timeMin = zonedToUTC(dateStr, '00:00', TZ).toISOString();
  const timeMax = zonedToUTC(dateStr, '23:59', TZ).toISOString();
  const res = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: TZ,
      items: [{ id: CALENDAR_ID }],
    },
  });
  const cal0 = res.data.calendars[CALENDAR_ID] || { busy: [] };
  return (cal0.busy || []).map((b) => ({ start: b.start, end: b.end }));
}

function buildEventBody(reservation, slot, statusLabel) {
  const seg = pricing.getSegment(reservation.segment);
  const start = zonedToUTC(reservation.requested_date, slot.start, TZ);
  const end = zonedToUTC(reservation.requested_date, slot.end, TZ);
  const segLabel = seg ? seg.label : reservation.segment;
  return {
    summary: `${statusLabel} · ${segLabel} — ${reservation.name}`,
    description: [
      `Reserva Bosque #${reservation.id}`,
      `Segmento: ${segLabel}`,
      `Pacote: ${reservation.package_id || '—'}`,
      `Pessoas: ${reservation.party_size || '—'}`,
      `Contacto: ${reservation.email}${reservation.phone ? ' · ' + reservation.phone : ''}`,
      reservation.message ? `Mensagem: ${reservation.message}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: end.toISOString(), timeZone: TZ },
  };
}

/** Create a tentative hold for a new reservation. Returns event id (or null). */
async function createTentative(reservation) {
  const slot = pricing.getSlot(reservation.segment, reservation.slot_key);
  if (!slot) throw new Error(`Unknown slot ${reservation.segment}/${reservation.slot_key}`);
  if (DRY_RUN) {
    const id = `dry-${reservation.id}-${Date.now()}`;
    console.log(`[calendar:DRY_RUN] createTentative -> ${id}`);
    return id;
  }
  const cal = getClient();
  const body = buildEventBody(reservation, slot, 'PROVISÓRIO');
  body.status = 'tentative';
  body.colorId = '5'; // banana / amber-ish = pending
  const res = await cal.events.insert({ calendarId: CALENDAR_ID, requestBody: body });
  return res.data.id;
}

/** Promote a held event to confirmed. */
async function confirmEvent(eventId, reservation) {
  if (DRY_RUN) {
    console.log(`[calendar:DRY_RUN] confirmEvent(${eventId})`);
    return;
  }
  if (!eventId) return;
  const cal = getClient();
  const slot = pricing.getSlot(reservation.segment, reservation.slot_key);
  const body = buildEventBody(reservation, slot, 'CONFIRMADO');
  body.status = 'confirmed';
  body.colorId = '10'; // basil / green = confirmed
  await cal.events.patch({ calendarId: CALENDAR_ID, eventId, requestBody: body });
}

/** Delete an event to free the slot (declined / cancelled). */
async function cancelEvent(eventId) {
  if (DRY_RUN) {
    console.log(`[calendar:DRY_RUN] cancelEvent(${eventId})`);
    return;
  }
  if (!eventId) return;
  const cal = getClient();
  try {
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (err) {
    if (err && err.code === 410) return; // already gone
    throw err;
  }
}

module.exports = { DRY_RUN, getDayBusy, createTentative, confirmEvent, cancelEvent };
