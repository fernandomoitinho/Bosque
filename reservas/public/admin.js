/* Bosque admin — reservation list + quote builder. */
(function () {
  'use strict';

  var STATUSES = [
    { key: '', label: 'Todas' },
    { key: 'new', label: 'Novas' },
    { key: 'quoted', label: 'Com proposta' },
    { key: 'confirmed', label: 'Confirmadas' },
    { key: 'declined', label: 'Recusadas' },
  ];
  var STATUS_LABEL = { new: 'Nova', quoted: 'Proposta', confirmed: 'Confirmada', declined: 'Recusada', cancelled: 'Cancelada' };

  var currentFilter = '';
  var currentId = null;
  var currency = 'EUR';
  var detailEl = document.getElementById('detail');
  var listEl = document.getElementById('reservation-list');

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
  function api(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { location.href = '/reservas/admin/login'; throw new Error('auth'); }
      return r.json();
    });
  }

  /* ── Filters ──────────────────────────────────────────────────── */
  var filtersEl = document.getElementById('filters');
  STATUSES.forEach(function (s) {
    var b = document.createElement('button');
    b.textContent = s.label;
    if (s.key === currentFilter) b.classList.add('active');
    b.addEventListener('click', function () {
      currentFilter = s.key;
      [].forEach.call(filtersEl.children, function (c) { c.classList.remove('active'); });
      b.classList.add('active');
      loadList();
    });
    filtersEl.appendChild(b);
  });

  /* ── List ─────────────────────────────────────────────────────── */
  function loadList() {
    api('/reservas/admin/api/reservations' + (currentFilter ? '?status=' + currentFilter : ''))
      .then(function (data) {
        var rows = data.reservations || [];
        if (!rows.length) { listEl.innerHTML = '<p class="muted">Sem reservas.</p>'; return; }
        listEl.innerHTML = '';
        rows.forEach(function (r) {
          var b = document.createElement('button');
          b.className = 'res-item' + (r.id === currentId ? ' active' : '');
          b.innerHTML =
            '<div class="ri-top"><span class="ri-name">' + esc(r.name) + '</span>' +
            '<span class="badge ' + r.status + '">' + (STATUS_LABEL[r.status] || r.status) + '</span></div>' +
            '<div class="ri-meta">' + esc(r.segmentLabel) + ' · ' + longDate(r.requested_date) + ' · ' + esc(r.slotLabel) + '</div>' +
            (r.quoteTotal != null ? '<div class="ri-meta">Proposta: ' + money(r.quoteTotal) + '</div>' : '');
          b.addEventListener('click', function () { openDetail(r.id); });
          listEl.appendChild(b);
        });
      });
  }

  /* ── Detail + quote builder ───────────────────────────────────── */
  function openDetail(id) {
    currentId = id;
    [].forEach.call(listEl.querySelectorAll('.res-item'), function (c) { c.classList.remove('active'); });
    api('/reservas/admin/api/reservations/' + id).then(renderDetail);
  }

  function renderDetail(data) {
    var r = data.reservation;
    var pkg = data.package;
    var quote = data.quote;
    var items = quote && quote.items && quote.items.length ? quote.items.slice() : data.suggestedItems.slice();
    var discountType = quote ? quote.discount_type : 'none';
    var discountValue = quote ? quote.discount_value : 0;
    var validUntil = quote ? (quote.valid_until || '') : '';
    var notes = quote ? (quote.notes || '') : '';
    var sentToken = quote && quote.public_token ? quote.public_token : null;

    var addons = (pkg && pkg.addons) || [];

    detailEl.innerHTML =
      '<div class="dt-head"><div>' +
        '<div class="dt-name">' + esc(r.name) + '</div>' +
        '<div class="muted">' + esc(r.segmentLabel) + (r.packageName ? ' · ' + esc(r.packageName) : '') + '</div>' +
      '</div><span class="badge ' + r.status + '">' + (STATUS_LABEL[r.status] || r.status) + '</span></div>' +
      '<div class="dt-grid">' +
        '<div><span class="k">Data</span></div><div>' + longDate(r.requested_date) + ' · ' + esc(r.slotLabel) + '</div>' +
        '<div><span class="k">Email</span></div><div><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a></div>' +
        '<div><span class="k">Telefone</span></div><div>' + (r.phone ? esc(r.phone) : '—') + '</div>' +
        '<div><span class="k">Pessoas</span></div><div>' + (r.party_size || '—') + '</div>' +
      '</div>' +
      (r.message ? '<div class="dt-msg">“' + esc(r.message) + '”</div>' : '') +
      '<div class="quote-box">' +
        '<h3>Proposta</h3>' +
        (addons.length ? '<div class="addon-suggestions" id="addons"></div>' : '') +
        '<table class="items"><thead><tr><th class="lbl">Item</th><th>Qt.</th><th>Unit.</th><th class="col-total">Total</th><th></th></tr></thead>' +
        '<tbody id="items-body"></tbody></table>' +
        '<div class="add-row"><button type="button" id="add-item">+ Adicionar linha</button></div>' +
        '<div class="disc-row">' +
          '<select id="disc-type">' +
            '<option value="none">Sem desconto</option>' +
            '<option value="percent">Desconto %</option>' +
            '<option value="fixed">Desconto fixo (€)</option>' +
          '</select>' +
          '<input type="number" id="disc-value" min="0" step="0.01" placeholder="0" />' +
        '</div>' +
        '<div class="totals">' +
          '<div class="line"><span>Subtotal</span><span id="t-subtotal">—</span></div>' +
          '<div class="line"><span>Desconto</span><span id="t-discount">—</span></div>' +
          '<div class="line grand"><span>Total</span><span id="t-total">—</span></div>' +
        '</div>' +
        '<div class="disc-row" style="margin-top:12px;">' +
          '<label class="field-inline" for="valid-until">Válida até</label>' +
          '<input type="date" id="valid-until" />' +
        '</div>' +
        '<div class="field" style="margin-top:10px;"><label for="notes" class="k">Nota (opcional)</label>' +
          '<textarea id="notes" class="dt-msg" style="width:100%;border:1px solid var(--line);" placeholder="Mensagem pessoal para o cliente…"></textarea></div>' +
        '<div class="quote-actions">' +
          '<button class="btn-ghost" id="save-quote">Guardar rascunho</button>' +
          '<button class="btn-primary" id="send-quote">Enviar proposta por email</button>' +
          '<button class="btn-ghost" id="decline-res">Recusar pedido</button>' +
        '</div>' +
        '<div class="send-result" id="send-result"></div>' +
      '</div>';

    // Populate controls
    var body = document.getElementById('items-body');
    function addItemRow(it) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="lbl"><input type="text" class="i-label" value="' + esc(it.label) + '" /></td>' +
        '<td class="col-qty"><input type="number" class="num i-qty" min="0" step="1" value="' + (it.qty != null ? it.qty : 1) + '" /></td>' +
        '<td class="col-unit"><input type="number" class="num i-unit" min="0" step="0.01" value="' + (it.unit_price != null ? it.unit_price : 0) + '" /></td>' +
        '<td class="col-total i-line">—</td>' +
        '<td class="col-x"><button type="button" class="x-btn" title="Remover">×</button></td>';
      tr.querySelector('.x-btn').addEventListener('click', function () { tr.remove(); recompute(); });
      tr.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('input', recompute); });
      body.appendChild(tr);
    }
    items.forEach(addItemRow);

    document.getElementById('add-item').addEventListener('click', function () {
      addItemRow({ label: '', qty: 1, unit_price: 0 }); recompute();
    });

    if (addons.length) {
      var addonsEl = document.getElementById('addons');
      addons.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = '+ ' + a.label + (a.price ? ' (' + money(a.price) + ')' : '');
        b.addEventListener('click', function () { addItemRow({ label: a.label, qty: 1, unit_price: a.price }); recompute(); });
        addonsEl.appendChild(b);
      });
    }

    var discTypeEl = document.getElementById('disc-type');
    var discValEl = document.getElementById('disc-value');
    discTypeEl.value = discountType; discValEl.value = discountValue || '';
    discTypeEl.addEventListener('change', recompute);
    discValEl.addEventListener('input', recompute);
    document.getElementById('valid-until').value = validUntil;
    document.getElementById('notes').value = notes;

    document.getElementById('save-quote').addEventListener('click', function () { saveQuote(r.id, false); });
    document.getElementById('send-quote').addEventListener('click', function () { saveQuote(r.id, true); });
    document.getElementById('decline-res').addEventListener('click', function () { declineRes(r.id); });

    if (sentToken) {
      document.getElementById('send-result').innerHTML =
        '<p class="notice notice-info">Proposta enviada. Link do cliente: ' +
        '<a href="/reservas/q/' + esc(sentToken) + '" target="_blank">/reservas/q/' + esc(sentToken) + '</a></p>';
    }

    recompute();
  }

  function gatherQuote() {
    var items = [].map.call(document.querySelectorAll('#items-body tr'), function (tr) {
      return {
        label: tr.querySelector('.i-label').value,
        qty: parseFloat(tr.querySelector('.i-qty').value) || 0,
        unit_price: parseFloat(tr.querySelector('.i-unit').value) || 0,
      };
    }).filter(function (it) { return it.label.trim(); });
    return {
      items: items,
      discount_type: document.getElementById('disc-type').value,
      discount_value: parseFloat(document.getElementById('disc-value').value) || 0,
      valid_until: document.getElementById('valid-until').value || null,
      notes: document.getElementById('notes').value.trim() || null,
    };
  }

  function recompute() {
    var q = gatherQuote();
    var subtotal = 0;
    [].forEach.call(document.querySelectorAll('#items-body tr'), function (tr) {
      var qty = parseFloat(tr.querySelector('.i-qty').value) || 0;
      var unit = parseFloat(tr.querySelector('.i-unit').value) || 0;
      var line = Math.round(qty * unit * 100) / 100;
      tr.querySelector('.i-line').textContent = money(line);
      subtotal += line;
    });
    subtotal = Math.round(subtotal * 100) / 100;
    var disc = 0;
    if (q.discount_type === 'percent') disc = Math.round(subtotal * Math.min(100, Math.max(0, q.discount_value)) / 100 * 100) / 100;
    else if (q.discount_type === 'fixed') disc = Math.min(subtotal, Math.max(0, q.discount_value));
    var total = Math.max(0, Math.round((subtotal - disc) * 100) / 100);
    document.getElementById('t-subtotal').textContent = money(subtotal);
    document.getElementById('t-discount').textContent = disc ? '−' + money(disc) : money(0);
    document.getElementById('t-total').textContent = money(total);
  }

  function saveQuote(resId, thenSend) {
    var payload = gatherQuote();
    if (!payload.items.length) { alert('Adicione pelo menos uma linha à proposta.'); return; }
    api('/reservas/admin/api/reservations/' + resId + '/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then(function (res) {
      if (!thenSend) {
        document.getElementById('send-result').innerHTML = '<p class="notice notice-info">Rascunho guardado.</p>';
        loadList();
        return;
      }
      sendQuote(res.quoteId);
    });
  }

  function sendQuote(quoteId) {
    api('/reservas/admin/api/quotes/' + quoteId + '/send', { method: 'POST' }).then(function (res) {
      var html = '<p class="notice notice-info">Proposta enviada' + (res.emailDryRun ? ' (modo DRY_RUN — email não enviado, ver consola)' : ' por email') + '.<br>' +
        'Link do cliente: <a href="' + esc(res.url) + '" target="_blank">' + esc(res.url) + '</a>';
      if (res.waLink) html += '<br><a href="' + esc(res.waLink) + '" target="_blank">Enviar também por WhatsApp →</a>';
      html += '</p>';
      document.getElementById('send-result').innerHTML = html;
      loadList();
      openDetail(currentId);
    });
  }

  function declineRes(resId) {
    if (!confirm('Recusar este pedido? O horário fica novamente livre.')) return;
    api('/reservas/admin/api/reservations/' + resId + '/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'declined' }),
    }).then(function () { loadList(); openDetail(resId); });
  }

  /* ── Boot ─────────────────────────────────────────────────────── */
  fetch('/reservas/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
    currency = cfg.currency || 'EUR';
    loadList();
  });
})();
