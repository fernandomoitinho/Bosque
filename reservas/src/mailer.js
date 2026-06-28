'use strict';

/**
 * Email via Nodemailer (Gmail). All copy is European Portuguese in the Bosque
 * "anfitrião" host voice (warm, calm, first-person-plural, never hype).
 *
 * Templates:
 *   - autoReply     -> immediate acknowledgement to the customer on request
 *   - ownerAlert    -> notify Fernando of a new request
 *   - quote         -> the prepared quote, with a link to the public quote page
 *   - confirmation  -> sent to customer + owner once a quote is accepted
 *
 * In DRY_RUN (or with missing Gmail creds) emails are logged, not sent.
 */

const pricing = require('./pricing');
const { money, longDate, escapeHtml } = require('./format');

const DRY_RUN =
  process.env.DRY_RUN === '1' ||
  !process.env.GMAIL_USER ||
  !process.env.GMAIL_APP_PASSWORD;

const FROM = `Bosque <${process.env.GMAIL_USER || 'ola@bosque.pt'}>`;
const OWNER = process.env.OWNER_NOTIFY_EMAIL || process.env.GMAIL_USER;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

let transporter = null;
function getTransport() {
  if (DRY_RUN) return null;
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return transporter;
}

async function send({ to, subject, html, text }) {
  if (DRY_RUN) {
    console.log(`[mail:DRY_RUN] to=${to} | subject=${subject}`);
    return { dryRun: true };
  }
  return getTransport().sendMail({ from: FROM, to, subject, html, text });
}

/* ── Shared HTML shell ──────────────────────────────────────────────────── */
function shell(bodyHtml) {
  return `<!doctype html><html lang="pt"><body style="margin:0;background:#F3EFE7;font-family:Inter,Helvetica,Arial,sans-serif;color:#1C2A22;line-height:1.6;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <div style="font-family:Georgia,serif;font-size:24px;font-weight:600;color:#1C2A22;margin-bottom:24px;">Bosque<span style="color:#C97B3C;">.</span></div>
      <div style="background:#fff;border-radius:18px;padding:28px 26px;box-shadow:0 8px 28px -10px rgba(28,42,34,.18);">
        ${bodyHtml}
      </div>
      <p style="font-size:12px;color:#5E6E65;margin-top:22px;text-align:center;">
        Bosque · Belverde, Margem Sul · <a href="${BASE_URL}" style="color:#C97B3C;">${BASE_URL.replace(/^https?:\/\//, '')}</a><br>
        O seu refúgio, moldado ao seu momento.
      </p>
    </div>
  </body></html>`;
}

function segLabel(segment) {
  const seg = pricing.getSegment(segment);
  return seg ? seg.label : 'Bosque';
}

function slotLabel(segment, slotKey) {
  const slot = pricing.getSlot(segment, slotKey);
  return slot ? slot.label : slotKey;
}

/* ── 1. Auto-reply to the customer ──────────────────────────────────────── */
async function autoReply(reservation) {
  const subject = `Recebemos o seu pedido — ${segLabel(reservation.segment)}`;
  const html = shell(`
    <p style="margin:0 0 14px;">Olá ${escapeHtml(reservation.name)},</p>
    <p style="margin:0 0 14px;">Recebemos o seu pedido e ficámos contentes por querer viver um momento no Bosque. Estamos a preparar tudo com cuidado.</p>
    <div style="background:#F3EFE7;border-radius:12px;padding:14px 16px;margin:18px 0;font-size:14px;">
      <strong>${escapeHtml(segLabel(reservation.segment))}</strong><br>
      ${escapeHtml(longDate(reservation.requested_date))} · ${escapeHtml(slotLabel(reservation.segment, reservation.slot_key))}<br>
      ${reservation.party_size ? escapeHtml(reservation.party_size) + ' pessoas' : ''}
    </div>
    <p style="margin:0 0 14px;">Voltamos a si em menos de 24 horas com uma proposta à medida do seu momento. Se entretanto quiser acrescentar algo, basta responder a este email.</p>
    <p style="margin:18px 0 0;">Até já,<br>Bosque</p>
  `);
  return send({ to: reservation.email, subject, html });
}

/* ── 2. Owner alert ─────────────────────────────────────────────────────── */
async function ownerAlert(reservation) {
  const subject = `Novo pedido #${reservation.id} — ${segLabel(reservation.segment)} (${reservation.requested_date})`;
  const html = shell(`
    <p style="margin:0 0 12px;"><strong>Novo pedido de reserva</strong></p>
    <table style="font-size:14px;border-collapse:collapse;width:100%;">
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;">Segmento</td><td>${escapeHtml(segLabel(reservation.segment))}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;">Nome</td><td>${escapeHtml(reservation.name)}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;">Contacto</td><td>${escapeHtml(reservation.email)}${reservation.phone ? ' · ' + escapeHtml(reservation.phone) : ''}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;">Data</td><td>${escapeHtml(longDate(reservation.requested_date))} · ${escapeHtml(slotLabel(reservation.segment, reservation.slot_key))}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;">Pessoas</td><td>${escapeHtml(reservation.party_size || '—')}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;">Pacote</td><td>${escapeHtml(reservation.package_id || '—')}</td></tr>
      <tr><td style="padding:3px 8px 3px 0;color:#5E6E65;vertical-align:top;">Mensagem</td><td>${escapeHtml(reservation.message || '—')}</td></tr>
    </table>
    <p style="margin:18px 0 0;"><a href="${BASE_URL}/reservas/admin" style="display:inline-block;background:#C97B3C;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:600;">Abrir no painel</a></p>
  `);
  return send({ to: OWNER, subject, html });
}

/* ── 3. Quote to the customer ───────────────────────────────────────────── */
function itemsTable(items, quote) {
  const rows = items
    .map(
      (it) => `<tr>
        <td style="padding:7px 0;border-bottom:1px solid #E4DCCB;">${escapeHtml(it.label)}</td>
        <td style="padding:7px 0;border-bottom:1px solid #E4DCCB;text-align:center;color:#5E6E65;">${escapeHtml(it.qty)}</td>
        <td style="padding:7px 0;border-bottom:1px solid #E4DCCB;text-align:right;">${money(it.line_total, quote.currency)}</td>
      </tr>`
    )
    .join('');
  let discountRow = '';
  if (quote.discount_type !== 'none' && quote.discount_value > 0) {
    const label =
      quote.discount_type === 'percent'
        ? `Desconto (${quote.discount_value}%)`
        : 'Desconto';
    discountRow = `<tr>
      <td colspan="2" style="padding:7px 0;color:#5E6E65;">${label}</td>
      <td style="padding:7px 0;text-align:right;color:#5E6E65;">−${money(quote.subtotal - quote.total, quote.currency)}</td>
    </tr>`;
  }
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0;">
    ${rows}
    ${discountRow}
    <tr>
      <td colspan="2" style="padding:12px 0 0;font-weight:700;">Total</td>
      <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:17px;">${money(quote.total, quote.currency)}</td>
    </tr>
  </table>`;
}

async function quoteEmail(reservation, quote, items) {
  const url = `${BASE_URL}/reservas/q/${quote.public_token}`;
  const subject = `A sua proposta Bosque — ${segLabel(reservation.segment)}`;
  const html = shell(`
    <p style="margin:0 0 14px;">Olá ${escapeHtml(reservation.name)},</p>
    <p style="margin:0 0 14px;">Preparámos uma proposta para o seu momento no Bosque, ${escapeHtml(longDate(reservation.requested_date))} (${escapeHtml(slotLabel(reservation.segment, reservation.slot_key))}).</p>
    ${itemsTable(items, quote)}
    ${quote.notes ? `<p style="margin:0 0 14px;font-size:14px;color:#5E6E65;">${escapeHtml(quote.notes)}</p>` : ''}
    ${quote.valid_until ? `<p style="margin:0 0 14px;font-size:13px;color:#5E6E65;">Proposta válida até ${escapeHtml(longDate(quote.valid_until))}.</p>` : ''}
    <p style="margin:20px 0 0;"><a href="${url}" style="display:inline-block;background:#C97B3C;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;">Ver e responder à proposta</a></p>
    <p style="margin:18px 0 0;font-size:13px;color:#5E6E65;">Qualquer ajuste, é só responder a este email — adaptamos ao seu momento.</p>
  `);
  return send({ to: reservation.email, subject, html });
}

/* ── 4. Confirmation (customer + owner) ─────────────────────────────────── */
async function confirmationEmail(reservation, quote, items) {
  const subject = `Reserva confirmada — ${segLabel(reservation.segment)}, ${longDate(reservation.requested_date)}`;
  const htmlCustomer = shell(`
    <p style="margin:0 0 14px;">Olá ${escapeHtml(reservation.name)},</p>
    <p style="margin:0 0 14px;">Está confirmado. Reservámos o espaço para si e já está tudo no nosso calendário.</p>
    <div style="background:#F3EFE7;border-radius:12px;padding:14px 16px;margin:18px 0;font-size:14px;">
      <strong>${escapeHtml(segLabel(reservation.segment))}</strong><br>
      ${escapeHtml(longDate(reservation.requested_date))} · ${escapeHtml(slotLabel(reservation.segment, reservation.slot_key))}<br>
      Total: <strong>${money(quote.total, quote.currency)}</strong>
    </div>
    <p style="margin:0 0 14px;">Nos próximos dias falamos sobre os últimos detalhes. Até lá, descanse — tratamos de tudo.</p>
    <p style="margin:18px 0 0;">Com carinho,<br>Bosque</p>
  `);
  await send({ to: reservation.email, subject, html: htmlCustomer });

  const htmlOwner = shell(`
    <p style="margin:0 0 12px;"><strong>Reserva #${reservation.id} confirmada</strong></p>
    <p style="margin:0 0 6px;font-size:14px;">${escapeHtml(reservation.name)} — ${escapeHtml(segLabel(reservation.segment))}</p>
    <p style="margin:0 0 6px;font-size:14px;">${escapeHtml(longDate(reservation.requested_date))} · ${escapeHtml(slotLabel(reservation.segment, reservation.slot_key))}</p>
    <p style="margin:0;font-size:14px;">Total: <strong>${money(quote.total, quote.currency)}</strong></p>
  `);
  return send({ to: OWNER, subject: `✓ ${subject}`, html: htmlOwner });
}

module.exports = {
  DRY_RUN,
  autoReply,
  ownerAlert,
  quoteEmail,
  confirmationEmail,
  itemsTable,
};
