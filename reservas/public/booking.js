/* Bosque booking flow — segment → package → date → live slots → details. */
(function () {
  'use strict';

  var state = { config: null, segment: null, pkg: null, date: null, slot: null };
  var els = {
    segmentGrid: document.getElementById('segment-grid'),
    cardPackage: document.getElementById('card-package'),
    packageGrid: document.getElementById('package-grid'),
    cardDate: document.getElementById('card-date'),
    dateInput: document.getElementById('date'),
    slotsArea: document.getElementById('slots-area'),
    cardDetails: document.getElementById('card-details'),
    summary: document.getElementById('summary'),
    form: document.getElementById('booking-form'),
    formError: document.getElementById('form-error'),
    submitBtn: document.getElementById('submit-btn'),
    submitLabel: document.getElementById('submit-label'),
    cardSuccess: document.getElementById('card-success'),
  };

  function money(v) {
    try {
      return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: state.config.currency || 'EUR' }).format(v);
    } catch (e) { return v + '€'; }
  }
  function setAccent(seg) {
    var v = (state.config.segments[seg] || {}).accentVar || '--amber-500';
    document.documentElement.style.setProperty('--accent', 'var(' + v + ')');
  }
  function longDate(d) {
    try { return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00')); }
    catch (e) { return d; }
  }

  /* ── Load config ──────────────────────────────────────────────── */
  fetch('/reservas/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
    state.config = cfg;
    renderSegments();
    // Pre-select segment from ?s=
    var s = new URLSearchParams(location.search).get('s');
    if (s && cfg.segments[s]) selectSegment(s);
  });

  function renderSegments() {
    var segs = state.config.segments;
    els.segmentGrid.innerHTML = '';
    Object.keys(segs).forEach(function (key) {
      var seg = segs[key];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.seg = key;
      b.innerHTML = '<span class="chip-title">' + seg.label + '</span><span class="chip-meta">' + seg.slogan + '</span>';
      b.addEventListener('click', function () { selectSegment(key); });
      els.segmentGrid.appendChild(b);
    });
  }

  function selectSegment(key) {
    state.segment = key; state.pkg = null; state.slot = null;
    setAccent(key);
    [].forEach.call(els.segmentGrid.children, function (c) {
      c.setAttribute('aria-pressed', c.dataset.seg === key ? 'true' : 'false');
    });
    renderPackages();
    els.cardPackage.classList.remove('hidden');
    els.cardDate.classList.remove('hidden');
    els.cardDetails.classList.add('hidden');
    if (state.date) loadSlots();
  }

  function renderPackages() {
    var pkgs = state.config.segments[state.segment].packages || [];
    els.packageGrid.innerHTML = '';
    pkgs.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.setAttribute('aria-pressed', 'false');
      b.dataset.pkg = p.id;
      b.innerHTML = '<span class="chip-title">' + p.name + ' · ' + money(p.base) + '</span><span class="chip-meta">' + p.desc + '</span>';
      b.addEventListener('click', function () { selectPackage(p); });
      els.packageGrid.appendChild(b);
    });
  }

  function selectPackage(p) {
    state.pkg = p; state.slot = null;
    [].forEach.call(els.packageGrid.children, function (c) {
      c.setAttribute('aria-pressed', c.dataset.pkg === p.id ? 'true' : 'false');
    });
    els.cardDetails.classList.add('hidden');
    if (state.date) loadSlots();
  }

  /* ── Date + slots ─────────────────────────────────────────────── */
  var today = new Date().toISOString().slice(0, 10);
  els.dateInput.min = today;
  els.dateInput.addEventListener('change', function () {
    state.date = els.dateInput.value; state.slot = null;
    els.cardDetails.classList.add('hidden');
    if (state.date) loadSlots();
  });

  function loadSlots() {
    if (!state.segment || !state.date) return;
    els.slotsArea.innerHTML = '<p class="notice notice-info">A consultar disponibilidade…</p>';
    var url = '/reservas/api/availability?segment=' + encodeURIComponent(state.segment) + '&date=' + encodeURIComponent(state.date);
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      renderSlots(data.slots || []);
    }).catch(function () {
      els.slotsArea.innerHTML = '<p class="notice notice-error">Não foi possível consultar a disponibilidade. Tente novamente.</p>';
    });
  }

  function allowedSlot(slotKey) {
    if (!state.pkg) return true;
    return (state.pkg.slots || []).indexOf(slotKey) !== -1;
  }

  function renderSlots(slots) {
    // Respect the selected package's allowed slots, if any.
    var relevant = slots.filter(function (s) { return allowedSlot(s.key); });
    var anyFree = relevant.some(function (s) { return s.available; });
    if (!relevant.length) {
      els.slotsArea.innerHTML = '<p class="notice notice-info">Sem horários definidos para esta seleção.</p>';
      return;
    }
    var grid = document.createElement('div');
    grid.className = 'chip-grid';
    relevant.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (s.available ? '' : ' is-busy');
      b.disabled = !s.available;
      b.setAttribute('aria-pressed', 'false');
      b.dataset.slot = s.key;
      b.innerHTML = '<span class="chip-title">' + s.label + '</span>' +
        '<span class="chip-meta">' + (s.available ? 'Disponível' : 'Ocupado') + '</span>';
      if (s.available) b.addEventListener('click', function () { selectSlot(s); });
      grid.appendChild(b);
    });
    els.slotsArea.innerHTML = '';
    if (!anyFree) {
      var n = document.createElement('p');
      n.className = 'notice notice-warn';
      n.textContent = 'Sem horários livres nesta data. Experimente outro dia.';
      els.slotsArea.appendChild(n);
    }
    els.slotsArea.appendChild(grid);
  }

  function selectSlot(s) {
    state.slot = s;
    [].forEach.call(els.slotsArea.querySelectorAll('.chip'), function (c) {
      c.setAttribute('aria-pressed', c.dataset.slot === s.key ? 'true' : 'false');
    });
    showDetails();
  }

  function showDetails() {
    var seg = state.config.segments[state.segment];
    els.summary.innerHTML = '<strong>' + seg.label + (state.pkg ? ' · ' + state.pkg.name : '') + '</strong>' +
      longDate(state.date) + ' · ' + state.slot.label;
    els.submitLabel.textContent = seg.ctaLabel || 'Enviar pedido';
    els.cardDetails.classList.remove('hidden');
    els.cardDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Submit ───────────────────────────────────────────────────── */
  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    els.formError.innerHTML = '';
    if (!state.slot) { showError('Escolha um horário disponível.'); return; }
    var name = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();
    if (!name) { showError('Indique o seu nome.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError('Indique um email válido.'); return; }

    var params = new URLSearchParams(location.search);
    var payload = {
      segment: state.segment,
      package_id: state.pkg ? state.pkg.id : null,
      requested_date: state.date,
      slot_key: state.slot.key,
      name: name,
      email: email,
      phone: document.getElementById('phone').value.trim(),
      party_size: document.getElementById('party_size').value,
      message: document.getElementById('message').value.trim(),
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
    };

    els.submitBtn.disabled = true;
    els.submitLabel.innerHTML = '<span class="spinner"></span>';
    fetch('/reservas/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    }).then(function (res) {
      if (!res.ok) {
        els.submitBtn.disabled = false;
        els.submitLabel.textContent = state.config.segments[state.segment].ctaLabel || 'Enviar pedido';
        showError(res.data.error || 'Não foi possível enviar. Tente novamente.');
        if (res.data.error && /disponível/i.test(res.data.error)) loadSlots();
        return;
      }
      els.cardDetails.classList.add('hidden');
      els.cardSuccess.classList.remove('hidden');
      els.cardSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }).catch(function () {
      els.submitBtn.disabled = false;
      showError('Erro de ligação. Tente novamente.');
    });
  });

  function showError(msg) {
    els.formError.innerHTML = '<p class="notice notice-error">' + msg + '</p>';
  }
})();
