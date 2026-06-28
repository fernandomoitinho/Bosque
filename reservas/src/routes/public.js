'use strict';

/**
 * Public (customer-facing) routes:
 *   GET  /api/config                    segments + slots + packages for the UI
 *   GET  /api/availability              free slots for a segment + date (live)
 *   POST /api/requests                  create a reservation (hold + auto-reply)
 *   GET  /q/:token                       quote view page (HTML)
 *   GET  /api/quote/:token               quote data (by public token)
 *   POST /api/quote/:token/respond       accept / decline a quote
 *
 * Mounted at /reservas by server.js.
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const db = require('../db');
const pricing = require('../pricing');
const slots = require('../slots');
const calendar = require('../calendar');
const mailer = require('../mailer');

const router = express.Router();

/* ── Prepared statements ────────────────────────────────────────────────── */
const insertReservation = db.prepare(`
  INSERT INTO reservations
    (segment, name, email, phone, party_size, requested_date, slot_key, package_id,
     message, status, utm_source, utm_medium, utm_campaign)
  VALUES
    (@segment, @name, @email, @phone, @party_size, @requested_date, @slot_key, @package_id,
     @message, 'new', @utm_source, @utm_medium, @utm_campaign)
`);
const setEventId = db.prepare(`UPDATE reservations SET calendar_event_id = ? WHERE id = ?`);
const activeOnDate = db.prepare(`
  SELECT segment, slot_key FROM reservations
  WHERE requested_date = ? AND status IN ('new','quoted','confirmed')
`);
const quoteByToken = db.prepare(`SELECT * FROM quotes WHERE public_token = ?`);
const itemsByQuote = db.prepare(`SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort, id`);
const reservationById = db.prepare(`SELECT * FROM reservations WHERE id = ?`);
const setQuoteStatus = db.prepare(`UPDATE quotes SET status = ?, updated_at = datetime('now') WHERE id = ?`);
const setReservationStatus = db.prepare(`UPDATE reservations SET status = ? WHERE id = ?`);

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** All busy intervals for a date: live calendar + DB-held reservations. */
async function busyForDate(dateStr) {
  let busy = [];
  try {
    busy = await calendar.getDayBusy(dateStr);
  } catch (err) {
    console.error('calendar.getDayBusy failed:', err.message);
  }
  for (const r of activeOnDate.all(dateStr)) {
    const interval = slots.reservationBusy(r.segment, dateStr, r.slot_key);
    if (interval) busy.push(interval);
  }
  return busy;
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

function publicConfig() {
  const out = {};
  for (const key of pricing.SEGMENT_KEYS) {
    const seg = pricing.getSegment(key);
    out[key] = {
      label: seg.label,
      slogan: seg.slogan,
      ctaLabel: seg.ctaLabel,
      accentVar: seg.accentVar,
      bgVar: seg.bgVar,
      slots: seg.slots,
      packages: seg.packages,
    };
  }
  return { currency: pricing.currency, segments: out };
}

/* ── Routes ─────────────────────────────────────────────────────────────── */

// Booking page (handles both /reservas and /reservas/).
router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'reservas', 'index.html'));
});

router.get('/api/config', (_req, res) => {
  res.json(publicConfig());
});

router.get('/api/availability', async (req, res) => {
  const { segment, date } = req.query;
  if (!pricing.getSegment(segment)) return res.status(400).json({ error: 'segmento inválido' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'data inválida' });

  // Refuse past dates.
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return res.json({ date, segment, slots: [] });

  const busy = await busyForDate(date);
  const computed = slots.computeSlots({ segment, date, busy });
  res.json({ date, segment, slots: computed });
});

router.post('/api/requests', express.json(), async (req, res) => {
  const b = req.body || {};
  const segment = b.segment;
  const seg = pricing.getSegment(segment);
  if (!seg) return res.status(400).json({ error: 'segmento inválido' });
  if (!isValidDate(b.requested_date)) return res.status(400).json({ error: 'data inválida' });
  if (!pricing.getSlot(segment, b.slot_key)) return res.status(400).json({ error: 'horário inválido' });
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'nome obrigatório' });
  if (!b.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email)) {
    return res.status(400).json({ error: 'email inválido' });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (b.requested_date < today) return res.status(400).json({ error: 'data no passado' });

  // Re-check the slot is still free (avoid race / double-book).
  const busy = await busyForDate(b.requested_date);
  const computed = slots.computeSlots({ segment, date: b.requested_date, busy });
  const chosen = computed.find((s) => s.key === b.slot_key);
  if (!chosen || !chosen.available) {
    return res.status(409).json({ error: 'Esse horário deixou de estar disponível. Escolha outro, por favor.' });
  }

  const info = insertReservation.run({
    segment,
    name: String(b.name).trim(),
    email: String(b.email).trim(),
    phone: b.phone ? String(b.phone).trim() : null,
    party_size: b.party_size ? parseInt(b.party_size, 10) || null : null,
    requested_date: b.requested_date,
    slot_key: b.slot_key,
    package_id: b.package_id || null,
    message: b.message ? String(b.message).trim() : null,
    utm_source: b.utm_source || null,
    utm_medium: b.utm_medium || null,
    utm_campaign: b.utm_campaign || null,
  });
  const reservation = reservationById.get(info.lastInsertRowid);

  // Hold the slot on the calendar (tentative), then send the auto-reply.
  try {
    const eventId = await calendar.createTentative(reservation);
    if (eventId) setEventId.run(eventId, reservation.id);
    reservation.calendar_event_id = eventId;
  } catch (err) {
    console.error('createTentative failed:', err.message);
  }
  try {
    await mailer.autoReply(reservation);
    await mailer.ownerAlert(reservation);
  } catch (err) {
    console.error('auto-reply/owner-alert failed:', err.message);
  }

  res.status(201).json({ ok: true, id: reservation.id });
});

/* ── Quote view (public, by token) ──────────────────────────────────────── */

router.get('/q/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'quote', 'index.html'));
});

router.get('/api/quote/:token', (req, res) => {
  const quote = quoteByToken.get(req.params.token);
  if (!quote || quote.status === 'draft') return res.status(404).json({ error: 'proposta não encontrada' });
  const reservation = reservationById.get(quote.reservation_id);
  const items = itemsByQuote.all(quote.id);
  const seg = pricing.getSegment(reservation.segment);
  const slot = pricing.getSlot(reservation.segment, reservation.slot_key);

  // Expire if past validity.
  let status = quote.status;
  if (status === 'sent' && quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) {
    status = 'expired';
  }

  res.json({
    token: quote.public_token,
    status,
    currency: quote.currency,
    subtotal: quote.subtotal,
    discount_type: quote.discount_type,
    discount_value: quote.discount_value,
    discountAmount: Math.round((quote.subtotal - quote.total) * 100) / 100,
    total: quote.total,
    valid_until: quote.valid_until,
    notes: quote.notes,
    items: items.map((i) => ({ label: i.label, qty: i.qty, unit_price: i.unit_price, line_total: i.line_total })),
    reservation: {
      name: reservation.name,
      segment: reservation.segment,
      segmentLabel: seg ? seg.label : reservation.segment,
      slogan: seg ? seg.slogan : '',
      accentVar: seg ? seg.accentVar : '--amber-500',
      bgVar: seg ? seg.bgVar : '--linen-200',
      date: reservation.requested_date,
      slotLabel: slot ? slot.label : reservation.slot_key,
      party_size: reservation.party_size,
    },
  });
});

router.post('/api/quote/:token/respond', express.json(), async (req, res) => {
  const action = req.body && req.body.action;
  const quote = quoteByToken.get(req.params.token);
  if (!quote || quote.status === 'draft') return res.status(404).json({ error: 'proposta não encontrada' });
  const reservation = reservationById.get(quote.reservation_id);

  if (quote.status === 'accepted' || quote.status === 'declined') {
    return res.json({ ok: true, status: quote.status }); // idempotent
  }
  if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) {
    return res.status(410).json({ error: 'Esta proposta expirou. Fale connosco para a renovarmos.' });
  }

  if (action === 'accept') {
    setQuoteStatus.run('accepted', quote.id);
    setReservationStatus.run('confirmed', reservation.id);
    const items = itemsByQuote.all(quote.id);
    try {
      await calendar.confirmEvent(reservation.calendar_event_id, reservation);
    } catch (err) {
      console.error('confirmEvent failed:', err.message);
    }
    try {
      await mailer.confirmationEmail(reservation, quote, items);
    } catch (err) {
      console.error('confirmationEmail failed:', err.message);
    }
    return res.json({ ok: true, status: 'accepted' });
  }

  if (action === 'decline') {
    setQuoteStatus.run('declined', quote.id);
    setReservationStatus.run('declined', reservation.id);
    try {
      await calendar.cancelEvent(reservation.calendar_event_id);
    } catch (err) {
      console.error('cancelEvent failed:', err.message);
    }
    return res.json({ ok: true, status: 'declined' });
  }

  return res.status(400).json({ error: 'ação inválida' });
});

module.exports = router;
