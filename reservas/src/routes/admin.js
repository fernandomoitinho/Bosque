'use strict';

/**
 * Admin (owner) routes — behind requireAuth except the login pages.
 *
 *   GET  /admin/login                      login page
 *   POST /admin/login                      authenticate
 *   POST /admin/logout                     end session
 *   GET  /admin                            dashboard SPA
 *   GET  /admin/api/reservations           list (optionally ?status=)
 *   GET  /admin/api/reservations/:id       detail + suggested line items + quote
 *   POST /admin/api/reservations/:id/quote save / update the draft quote
 *   POST /admin/api/reservations/:id/status set reservation status (e.g. decline)
 *   POST /admin/api/quotes/:id/send        finalize + email the quote
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const db = require('../db');
const pricing = require('../pricing');
const mailer = require('../mailer');
const calendar = require('../calendar');
const { computeTotals } = require('../quotes');
const { checkPassword, requireAuth } = require('../auth');

const router = express.Router();

/* ── Prepared statements ────────────────────────────────────────────────── */
const listAll = db.prepare(`SELECT * FROM reservations ORDER BY datetime(created_at) DESC`);
const listByStatus = db.prepare(
  `SELECT * FROM reservations WHERE status = ? ORDER BY datetime(created_at) DESC`
);
const reservationById = db.prepare(`SELECT * FROM reservations WHERE id = ?`);
const quoteByReservation = db.prepare(
  `SELECT * FROM quotes WHERE reservation_id = ? ORDER BY id DESC LIMIT 1`
);
const quoteById = db.prepare(`SELECT * FROM quotes WHERE id = ?`);
const itemsByQuote = db.prepare(`SELECT * FROM quote_items WHERE quote_id = ? ORDER BY sort, id`);
const insertQuote = db.prepare(`
  INSERT INTO quotes (reservation_id, status, currency, subtotal, discount_type, discount_value,
                      total, valid_until, notes)
  VALUES (@reservation_id, 'draft', @currency, @subtotal, @discount_type, @discount_value,
          @total, @valid_until, @notes)
`);
const updateQuote = db.prepare(`
  UPDATE quotes SET subtotal=@subtotal, discount_type=@discount_type, discount_value=@discount_value,
                    total=@total, valid_until=@valid_until, notes=@notes, updated_at=datetime('now')
  WHERE id=@id
`);
const deleteItems = db.prepare(`DELETE FROM quote_items WHERE quote_id = ?`);
const insertItem = db.prepare(`
  INSERT INTO quote_items (quote_id, label, qty, unit_price, line_total, sort)
  VALUES (@quote_id, @label, @qty, @unit_price, @line_total, @sort)
`);
const setQuoteSent = db.prepare(`
  UPDATE quotes SET status='sent', public_token=@token, sent_at=datetime('now'),
                    updated_at=datetime('now') WHERE id=@id
`);
const setReservationStatus = db.prepare(`UPDATE reservations SET status = ? WHERE id = ?`);

/* ── Helpers ────────────────────────────────────────────────────────────── */

/** Suggested initial line items for a reservation, from its package. */
function suggestedItems(reservation) {
  const pkg = pricing.getPackage(reservation.segment, reservation.package_id);
  if (!pkg) return [{ label: 'Reserva do espaço', qty: 1, unit_price: 0 }];
  const items = [{ label: pkg.name, qty: 1, unit_price: pkg.base }];
  // Add-ons are offered at 0 qty as a convenience for the owner to bump up.
  return items;
}

function persistQuote(reservationId, body) {
  const reservation = reservationById.get(reservationId);
  if (!reservation) return null;

  const totals = computeTotals(body.items, {
    type: body.discount_type || 'none',
    value: body.discount_value || 0,
  });

  let quote = quoteByReservation.get(reservationId);
  const payload = {
    reservation_id: reservationId,
    currency: pricing.currency,
    subtotal: totals.subtotal,
    discount_type: totals.discount_type,
    discount_value: totals.discount_value,
    total: totals.total,
    valid_until: body.valid_until || null,
    notes: body.notes || null,
  };

  const tx = db.transaction(() => {
    if (quote && (quote.status === 'draft' || quote.status === 'sent')) {
      updateQuote.run({ ...payload, id: quote.id });
    } else {
      const info = insertQuote.run(payload);
      quote = quoteById.get(info.lastInsertRowid);
    }
    deleteItems.run(quote.id);
    totals.items.forEach((it, idx) => {
      insertItem.run({
        quote_id: quote.id,
        label: it.label || 'Item',
        qty: it.qty,
        unit_price: it.unit_price,
        line_total: it.line_total,
        sort: idx,
      });
    });
  });
  tx();

  quote = quoteByReservation.get(reservationId);
  return { quote, totals };
}

/* ── Auth pages ─────────────────────────────────────────────────────────── */

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/reservas/admin');
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'admin', 'login.html'));
});

router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  if (checkPassword(req.body.password)) {
    req.session.isAdmin = true;
    return res.redirect('/reservas/admin');
  }
  return res.redirect('/reservas/admin/login?e=1');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/reservas/admin/login'));
});

/* ── SPA shell ──────────────────────────────────────────────────────────── */

router.get('/', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'admin', 'index.html'));
});

/* ── API (all behind auth) ──────────────────────────────────────────────── */

router.use('/api', requireAuth, express.json());

router.get('/api/reservations', (req, res) => {
  const rows = req.query.status ? listByStatus.all(req.query.status) : listAll.all();
  const data = rows.map((r) => {
    const seg = pricing.getSegment(r.segment);
    const slot = pricing.getSlot(r.segment, r.slot_key);
    const q = quoteByReservation.get(r.id);
    return {
      id: r.id,
      created_at: r.created_at,
      segment: r.segment,
      segmentLabel: seg ? seg.label : r.segment,
      name: r.name,
      email: r.email,
      phone: r.phone,
      party_size: r.party_size,
      requested_date: r.requested_date,
      slotLabel: slot ? slot.label : r.slot_key,
      status: r.status,
      quoteTotal: q ? q.total : null,
      quoteStatus: q ? q.status : null,
    };
  });
  res.json({ reservations: data });
});

router.get('/api/reservations/:id', (req, res) => {
  const r = reservationById.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'não encontrada' });
  const seg = pricing.getSegment(r.segment);
  const slot = pricing.getSlot(r.segment, r.slot_key);
  const pkg = pricing.getPackage(r.segment, r.package_id);
  const quote = quoteByReservation.get(r.id);
  const items = quote ? itemsByQuote.all(quote.id) : null;

  res.json({
    reservation: {
      ...r,
      segmentLabel: seg ? seg.label : r.segment,
      slotLabel: slot ? slot.label : r.slot_key,
      packageName: pkg ? pkg.name : null,
    },
    package: pkg,
    suggestedItems: suggestedItems(r),
    quote: quote
      ? {
          id: quote.id,
          status: quote.status,
          currency: quote.currency,
          subtotal: quote.subtotal,
          discount_type: quote.discount_type,
          discount_value: quote.discount_value,
          total: quote.total,
          valid_until: quote.valid_until,
          notes: quote.notes,
          public_token: quote.public_token,
          items: items.map((i) => ({ label: i.label, qty: i.qty, unit_price: i.unit_price })),
        }
      : null,
  });
});

router.post('/api/reservations/:id/quote', (req, res) => {
  const result = persistQuote(parseInt(req.params.id, 10), req.body || {});
  if (!result) return res.status(404).json({ error: 'reserva não encontrada' });
  res.json({
    ok: true,
    quoteId: result.quote.id,
    subtotal: result.totals.subtotal,
    discountAmount: result.totals.discountAmount,
    total: result.totals.total,
  });
});

router.post('/api/reservations/:id/status', async (req, res) => {
  const r = reservationById.get(req.params.id);
  if (!r) return res.status(404).json({ error: 'não encontrada' });
  const status = req.body && req.body.status;
  const allowed = ['new', 'quoted', 'confirmed', 'declined', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'estado inválido' });
  setReservationStatus.run(status, r.id);
  if ((status === 'declined' || status === 'cancelled') && r.calendar_event_id) {
    try {
      await calendar.cancelEvent(r.calendar_event_id);
    } catch (err) {
      console.error('cancelEvent failed:', err.message);
    }
  }
  res.json({ ok: true, status });
});

router.post('/api/quotes/:id/send', async (req, res) => {
  const quote = quoteById.get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'proposta não encontrada' });
  const reservation = reservationById.get(quote.reservation_id);

  const token = quote.public_token || crypto.randomBytes(16).toString('hex');
  setQuoteSent.run({ token, id: quote.id });
  setReservationStatus.run('quoted', reservation.id);
  const fresh = quoteById.get(quote.id);
  const items = itemsByQuote.all(quote.id);

  try {
    await mailer.quoteEmail(reservation, fresh, items);
  } catch (err) {
    console.error('quoteEmail failed:', err.message);
  }

  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = `${baseUrl}/reservas/q/${token}`;

  // Convenience one-tap WhatsApp link (manual send, no API).
  let waLink = null;
  if (reservation.phone) {
    const digits = String(reservation.phone).replace(/[^\d]/g, '');
    if (digits) {
      const text = `Olá ${reservation.name}, preparámos a sua proposta Bosque: ${url}`;
      waLink = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
    }
  }

  res.json({ ok: true, token, url, waLink, emailDryRun: mailer.DRY_RUN });
});

module.exports = router;
