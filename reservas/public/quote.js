/* Bosque customer quote page — view + accept / decline. */
(function () {
  'use strict';

  var token = location.pathname.split('/').filter(Boolean).pop();
  var root = document.getElementById('quote-root');
  var currency = 'EUR';

  function money(v) {
    try { return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency }).format(v || 0); }
    catch (e) { return (v || 0) + '€'; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function longDate(d) {
    if (!d) return '';
    try { return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00')); }
    catch (e) { return d; }
  }

  fetch('/reservas/api/quote/' + encodeURIComponent(token))
    .then(function (r) { if (!r.ok) throw new Error('notfound'); return r.json(); })
    .then(render)
    .catch(function () {
      root.innerHTML = '<div class="rsv-card center"><h3>Proposta não encontrada</h3>' +
        '<p class="muted" style="margin-top:8px;">O link pode ter expirado. Fale connosco e renovamos a sua proposta.</p></div>';
    });

  function render(q) {
    currency = q.currency || 'EUR';
    var r = q.reservation;
    if (r.accentVar) document.documentElement.style.setProperty('--accent', 'var(' + r.accentVar + ')');

    var itemRows = q.items.map(function (it) {
      return '<tr><td style="padding:8px 0;border-bottom:1px solid var(--line);">' + esc(it.label) +
        '</td><td style="padding:8px 0;border-bottom:1px solid var(--line);text-align:center;color:var(--muted);">' + esc(it.qty) +
        '</td><td style="padding:8px 0;border-bottom:1px solid var(--line);text-align:right;">' + money(it.line_total) + '</td></tr>';
    }).join('');

    var discRow = '';
    if (q.discount_type !== 'none' && q.discountAmount > 0) {
      var dl = q.discount_type === 'percent' ? 'Desconto (' + q.discount_value + '%)' : 'Desconto';
      discRow = '<tr><td colspan="2" style="padding:8px 0;color:var(--muted);">' + dl +
        '</td><td style="padding:8px 0;text-align:right;color:var(--muted);">−' + money(q.discountAmount) + '</td></tr>';
    }

    var statusBanner = '';
    if (q.status === 'accepted') statusBanner = '<p class="notice notice-info">Esta proposta já foi <strong>aceite</strong>. Até já! 🌿</p>';
    else if (q.status === 'declined') statusBanner = '<p class="notice notice-warn">Esta proposta foi recusada. Se mudou de ideias, fale connosco.</p>';
    else if (q.status === 'expired') statusBanner = '<p class="notice notice-warn">Esta proposta expirou. Fale connosco para a renovarmos.</p>';

    var actions = (q.status === 'sent')
      ? '<div class="quote-actions" style="display:flex;gap:10px;margin-top:22px;">' +
          '<button class="btn-primary" id="accept">Aceitar proposta</button>' +
          '<button class="btn-ghost" id="decline">Recusar</button>' +
        '</div>'
      : '';

    root.innerHTML =
      '<p class="rsv-eyebrow">' + esc(r.segmentLabel) + '</p>' +
      '<h1 class="rsv-title">Olá ' + esc(r.name) + ', a sua proposta</h1>' +
      (r.slogan ? '<p class="rsv-sub">' + esc(r.slogan) + '</p>' : '') +
      statusBanner +
      '<section class="rsv-card">' +
        '<div class="summary-box"><strong>' + esc(r.segmentLabel) + '</strong>' +
          longDate(r.date) + ' · ' + esc(r.slotLabel) + (r.party_size ? ' · ' + esc(r.party_size) + ' pessoas' : '') + '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:.95rem;margin-top:8px;">' +
          '<tbody>' + itemRows + discRow +
          '<tr><td colspan="2" style="padding:14px 0 0;font-weight:700;">Total</td>' +
          '<td style="padding:14px 0 0;text-align:right;font-weight:700;font-size:1.2rem;">' + money(q.total) + '</td></tr>' +
        '</tbody></table>' +
        (q.notes ? '<p class="muted" style="margin-top:14px;">' + esc(q.notes) + '</p>' : '') +
        (q.valid_until ? '<p class="muted" style="margin-top:10px;font-size:.85rem;">Válida até ' + longDate(q.valid_until) + '.</p>' : '') +
        actions +
        '<div id="result"></div>' +
      '</section>';

    if (q.status === 'sent') {
      document.getElementById('accept').addEventListener('click', function () { respond('accept'); });
      document.getElementById('decline').addEventListener('click', function () { respond('decline'); });
    }
  }

  function respond(action) {
    if (action === 'decline' && !confirm('Tem a certeza de que quer recusar esta proposta?')) return;
    var btns = root.querySelectorAll('button');
    [].forEach.call(btns, function (b) { b.disabled = true; });
    fetch('/reservas/api/quote/' + encodeURIComponent(token) + '/respond', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action }),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var el = document.getElementById('result');
        if (!res.ok) { el.innerHTML = '<p class="notice notice-error">' + esc(res.d.error || 'Erro. Tente novamente.') + '</p>';
          [].forEach.call(btns, function (b) { b.disabled = false; }); return; }
        if (res.d.status === 'accepted') {
          el.innerHTML = '<p class="notice notice-info" style="margin-top:16px;">Proposta aceite 🌿 Enviámos-lhe um email de confirmação. Reservámos o espaço para si.</p>';
        } else {
          el.innerHTML = '<p class="notice notice-warn" style="margin-top:16px;">Proposta recusada. Obrigado por nos ter dado a conhecer o seu momento.</p>';
        }
        var actionsEl = root.querySelector('.quote-actions');
        if (actionsEl) actionsEl.remove();
      });
  }
})();
