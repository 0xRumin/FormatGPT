// reorder.js – V2 Reorder mode with interactive panel
(function () {
  var U = App.Utils;
  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ======== Constants ======== */
  var ALL_FIELDS = [
    'username', 'password', 'email', 'emailpassword', 'phone',
    'ct0', 'auth_token', 'twofa', 'counts', 'date'
  ];

  var FIELD_LABELS = {
    username: 'username', password: 'password', email: 'email',
    emailpassword: 'emailpassword', phone: 'phone', ct0: 'ct0',
    auth_token: 'auth_token', twofa: 'twofa', counts: 'counts', date: 'date'
  };

  // Panel field ID → classifier type key
  var FIELD_TO_TYPE = {
    username: 'user', password: 'pass', email: 'mail',
    emailpassword: 'mailpass', phone: 'phone', ct0: 'ct0',
    auth_token: 'auth', twofa: '2fa', counts: 'counts', date: 'year'
  };

  var PRESETS = {
    original:    ALL_FIELDS.slice(),
    login:       ['username', 'password'],
    fullCreds:   ['username', 'password', 'email', 'emailpassword', 'auth_token', 'twofa'],
    apiBot:      ['username', 'password', 'auth_token', 'ct0', 'twofa'],
    accountInfo: ['username', 'email', 'phone', 'date', 'counts'],
    allFields:   ALL_FIELDS.slice()
  };

  var SEPS = [':', '|', ',', '\t', ' ', ';'];
  var SEP_LABELS = { ':': ':', '|': '|', ',': ',', '\t': 'TAB', ' ': 'SPACE', ';': ';' };

  /* ======== State defaults ========
     V2 Reorder ALWAYS boots on "Original" — fields auto-detect from whatever
     the user pastes in. Previous "custom" selection from localStorage is
     intentionally overridden here each page load. */
  state.reorderPreset = 'original';
  state.reorderFields = ALL_FIELDS.slice();
  if (!state.reorderEnabled || typeof state.reorderEnabled !== 'object') {
    state.reorderEnabled = {};
    ALL_FIELDS.forEach(function (f) { state.reorderEnabled[f] = true; });
  }
  if (!state.reorderSep) state.reorderSep = ':';

  function saveState() {
    localStorage.setItem('reorderFields', JSON.stringify(state.reorderFields));
    localStorage.setItem('reorderEnabled', JSON.stringify(state.reorderEnabled));
    localStorage.setItem('reorderSep', state.reorderSep);
    localStorage.setItem('reorderPreset', state.reorderPreset);
  }

  /* ======== Field Classification ======== */
  function classifyParts(parts) {
    var tagged = parts.map(function (raw, i) {
      var p = (raw || '').trim();
      if (!p) return { value: p, type: null, idx: i };
      if (U.isCt0(p))   return { value: p, type: 'ct0',    idx: i };
      if (U.isHex40(p))  return { value: p, type: 'auth',   idx: i };
      if (U.is2FAKey(p)) return { value: p, type: '2fa',    idx: i };
      if (U.isEmail(p))  return { value: p, type: 'mail',   idx: i };
      if (/^\+/.test(p) && /^\d{10,15}$/.test(U.onlyDigits(p)))
                          return { value: p, type: 'phone',  idx: i };
      if (/^\d{4}$/.test(p) && +p >= 2007 && +p <= 2100)
                          return { value: p, type: 'year',   idx: i };
      if (/^\d+$/.test(p) && !(/^\d{4}$/.test(p) && +p >= 2007 && +p <= 2100))
                          return { value: p, type: 'counts', idx: i };
      return { value: p, type: null, idx: i };
    });

    var emailEntry = tagged.find(function (t) { return t.type === 'mail'; });
    var emailIdx = emailEntry ? emailEntry.idx : -1;
    var unknowns = tagged.filter(function (t) { return t.type === null && t.value; });

    if (unknowns.length >= 1) unknowns[0].type = 'user';
    if (unknowns.length >= 2) unknowns[1].type = 'pass';
    if (emailIdx >= 0) {
      for (var i = 2; i < unknowns.length; i++) {
        if (unknowns[i].idx > emailIdx) { unknowns[i].type = 'mailpass'; break; }
      }
    }

    var fields = {};
    tagged.forEach(function (t) { if (t.type) fields[t.type] = t.value; });
    return fields;
  }

  /* ======== Auto-detect which fields are present in input ======== */
  function detectPresentFields(text) {
    var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    // Empty input → default to all fields enabled so the panel shows something
    // usable (otherwise every checkbox would be off and the output would be blank).
    if (!rows.length) {
      var allOn = {};
      ALL_FIELDS.forEach(function (f) { allOn[f] = true; });
      return allOn;
    }
    var foundTypes = {};
    for (var r = 0; r < rows.length; r++) {
      var parts = U.splitFlexible(rows[r]);
      var classified = classifyParts(parts);
      for (var type in classified) foundTypes[type] = true;
    }
    var enabled = {};
    ALL_FIELDS.forEach(function (f) { enabled[f] = !!foundTypes[FIELD_TO_TYPE[f]]; });
    return enabled;
  }

  /* ======== Process one line ======== */
  function processLine(row) {
    var parts = U.splitFlexible(row);
    var classified = classifyParts(parts);
    var result = [];
    var fields  = state.reorderFields  || ALL_FIELDS;
    var enabled = state.reorderEnabled || {};
    var sep     = state.reorderSep     || ':';

    for (var i = 0; i < fields.length; i++) {
      if (!enabled[fields[i]]) continue;
      var val = classified[FIELD_TO_TYPE[fields[i]]];
      if (val) result.push(val);
    }
    return result.join(sep);
  }

  /* ======== Panel builder ======== */
  var panelBuilt = false;

  function ensurePanelEl() {
    var panel = $('#reorderPanel');
    if (panel) return panel;
    // Create it dynamically if HTML doesn't have it (cache-proof)
    panel = document.createElement('section');
    panel.id = 'reorderPanel';
    panel.className = 'card';
    panel.style.display = 'block';
    // Insert between the two main cards
    var cards = document.querySelectorAll('main > .card');
    if (cards.length >= 2) {
      cards[0].parentNode.insertBefore(panel, cards[1]);
    } else {
      document.querySelector('main').appendChild(panel);
    }
    return panel;
  }

  function buildPanel() {
    var panel = ensurePanelEl();
    if (!panel || panelBuilt) return;
    panelBuilt = true;
    panel.style.display = 'block';

    var h = '';

    // — Header
    h += '<div class="rp-header" id="rpHeader">';
    h += '<div class="rp-header-left">';
    h += '<svg class="rp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
    h += '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>';
    h += '<circle cx="6" cy="5" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="6" cy="19" r="1"/>';
    h += '</svg>';
    h += '<div><div class="rp-title">Format & Export</div>';
    h += '<div class="rp-subtitle" id="rpSubtitle">Customize format</div></div>';
    h += '</div>';
    h += '<svg class="rp-chevron" id="rpChevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    h += '</div>';

    // — Collapsible body
    h += '<div class="rp-body" id="rpBody">';

    // Quick Presets
    h += '<div class="rp-section"><div class="rp-label">\u2728 QUICK PRESETS</div><div class="rp-presets" id="rpPresets">';
    [['original','Original'],['login','Login'],['fullCreds','Full Credentials'],
     ['apiBot','API / Bot'],['accountInfo','Account Info'],['allFields','All Fields'],
     ['custom','Custom']].forEach(function (p) {
      var cls = state.reorderPreset === p[0] ? ' rp-active' : '';
      h += '<button class="rp-preset' + cls + '" data-preset="' + p[0] + '">' + p[1] + '</button>';
    });
    h += '</div></div>';

    // Separator
    h += '<div class="rp-section"><div class="rp-label">SEPARATOR</div><div class="rp-seps" id="rpSeps">';
    SEPS.forEach(function (s) {
      var cls = state.reorderSep === s ? ' rp-active' : '';
      h += '<button class="rp-sep' + cls + '" data-sep="' + encodeURIComponent(s) + '">' + SEP_LABELS[s] + '</button>';
    });
    h += '</div></div>';

    // Fields & Order
    h += '<div class="rp-section"><div class="rp-label">FIELDS & ORDER';
    h += '<span class="rp-sel-acts"><a href="#" id="rpSelectAll">Select all</a> / <a href="#" id="rpDeselectAll">Deselect all</a></span>';
    h += '</div><div class="rp-fields" id="rpFields">';
    h += buildFieldRows();
    h += '</div></div>';

    // Preview
    h += '<div class="rp-section"><div class="rp-label">\u25C9 PREVIEW</div>';
    h += '<pre class="rp-preview" id="rpPreview">(paste data above to see preview)</pre>';
    h += '</div>';

    h += '</div>'; // rp-body

    panel.innerHTML = h;
    bindPanelEvents();
  }

  function buildFieldRows() {
    var h = '';
    (state.reorderFields || ALL_FIELDS).forEach(function (f) {
      var chk = state.reorderEnabled[f] ? ' checked' : '';
      var on  = state.reorderEnabled[f] ? ' rp-on'   : '';
      h += '<div class="rp-field-row' + on + '" data-field="' + f + '">';
      h += '<span class="rp-drag" aria-label="Drag to reorder">\u2807</span>';
      h += '<input type="checkbox" class="rp-check"' + chk + '>';
      h += '<span class="rp-fname">' + FIELD_LABELS[f] + '</span>';
      h += '<span class="rp-fkey">' + FIELD_LABELS[f] + '</span>';
      h += '</div>';
    });
    return h;
  }

  /* ======== Panel event bindings ======== */
  function bindPanelEvents() {
    // Collapse / expand
    $('#rpHeader').addEventListener('click', function () {
      $('#rpBody').classList.toggle('rp-collapsed');
      $('#rpChevron').classList.toggle('rp-flipped');
    });

    // Presets
    $('#rpPresets').addEventListener('click', function (e) {
      var btn = e.target.closest('.rp-preset');
      if (!btn) return;
      applyPreset(btn.dataset.preset);
    });

    // Separators
    $('#rpSeps').addEventListener('click', function (e) {
      var btn = e.target.closest('.rp-sep');
      if (!btn) return;
      state.reorderSep = decodeURIComponent(btn.dataset.sep);
      state.reorderPreset = 'custom';
      saveState();
      syncSepBtns();
      syncPresetBtns();
      refresh();
    });

    // Checkboxes
    $('#rpFields').addEventListener('change', function (e) {
      if (!e.target.classList.contains('rp-check')) return;
      var row = e.target.closest('.rp-field-row');
      state.reorderEnabled[row.dataset.field] = e.target.checked;
      row.classList.toggle('rp-on', e.target.checked);
      state.reorderPreset = 'custom';
      saveState();
      syncPresetBtns();
      refresh();
    });

    // Select all / Deselect all
    $('#rpSelectAll').addEventListener('click', function (e) {
      e.preventDefault();
      ALL_FIELDS.forEach(function (f) { state.reorderEnabled[f] = true; });
      state.reorderPreset = 'custom';
      saveState();
      syncFieldRows();
      syncPresetBtns();
      refresh();
    });
    $('#rpDeselectAll').addEventListener('click', function (e) {
      e.preventDefault();
      ALL_FIELDS.forEach(function (f) { state.reorderEnabled[f] = false; });
      state.reorderPreset = 'custom';
      saveState();
      syncFieldRows();
      syncPresetBtns();
      refresh();
    });

    // Drag & drop
    initDrag();
  }

  /* ======== Drag & Drop (touch + mouse) ======== */
  function initDrag() {
    var container = $('#rpFields');
    container.addEventListener('mousedown', onDown);
    container.addEventListener('touchstart', onDown, { passive: false });
  }

  function onDown(e) {
    var handle = e.target.closest('.rp-drag');
    if (!handle) return;
    e.preventDefault();

    var row       = handle.closest('.rp-field-row');
    var container = row.parentElement;
    row.classList.add('rp-dragging');

    var move = function (ev) {
      ev.preventDefault();
      var cy   = ev.touches ? ev.touches[0].clientY : ev.clientY;
      var rows = Array.from(container.children);
      var idx  = rows.indexOf(row);

      for (var i = 0; i < rows.length; i++) {
        if (i === idx) continue;
        var rect = rows[i].getBoundingClientRect();
        var mid  = rect.top + rect.height / 2;
        if (cy < mid && i < idx) {
          container.insertBefore(row, rows[i]);
          break;
        } else if (cy > mid && i > idx) {
          container.insertBefore(row, rows[i].nextSibling);
          break;
        }
      }
    };

    var up = function () {
      row.classList.remove('rp-dragging');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchend', up);

      // Persist new order
      state.reorderFields = Array.from(container.children).map(function (r) { return r.dataset.field; });
      state.reorderPreset = 'custom';
      saveState();
      syncPresetBtns();
      refresh();
    };

    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('mouseup', up);
    document.addEventListener('touchend', up);
  }

  /* ======== UI sync helpers ======== */
  function syncPresetBtns() {
    var btns = document.querySelectorAll('#rpPresets .rp-preset');
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle('rp-active', btns[i].dataset.preset === state.reorderPreset);
  }

  function syncSepBtns() {
    var btns = document.querySelectorAll('#rpSeps .rp-sep');
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle('rp-active', decodeURIComponent(btns[i].dataset.sep) === state.reorderSep);
  }

  function syncFieldRows() {
    var rows = document.querySelectorAll('#rpFields .rp-field-row');
    for (var i = 0; i < rows.length; i++) {
      var f  = rows[i].dataset.field;
      var cb = rows[i].querySelector('.rp-check');
      if (cb) cb.checked = !!state.reorderEnabled[f];
      rows[i].classList.toggle('rp-on', !!state.reorderEnabled[f]);
    }
  }

  function rebuildFieldRows() {
    var c = $('#rpFields');
    if (c) c.innerHTML = buildFieldRows();
  }

  function updatePreview() {
    var pre = $('#rpPreview');
    if (!pre) return;
    var inp  = $('#inp');
    var text = inp ? inp.value : '';
    var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);

    var sub = $('#rpSubtitle');
    if (sub) sub.textContent = 'Customize format for ' + rows.length + ' account(s)';

    var lines = [];
    var limit = Math.min(rows.length, 3);
    for (var i = 0; i < limit; i++) {
      var l = processLine(rows[i]);
      if (l) lines.push(l);
    }
    pre.textContent = lines.length ? lines.join('\n') : '(paste data above to see preview)';
  }

  function refresh() {
    updatePreview();
    App.App.rerun();
  }

  /* ======== Preset application ======== */
  function applyPreset(name) {
    if (name === 'custom') {
      state.reorderPreset = 'custom';
      saveState();
      syncPresetBtns();
      return;
    }

    // "Original" = auto-detect from input, enable only fields that exist
    if (name === 'original') {
      var inp = $('#inp');
      var text = inp ? inp.value : '';
      state.reorderEnabled = detectPresentFields(text);
      state.reorderFields = ALL_FIELDS.slice();
      state.reorderPreset = 'original';
      saveState();
      rebuildFieldRows();
      syncPresetBtns();
      refresh();
      return;
    }

    var enabledList = PRESETS[name];
    if (!enabledList) return;

    ALL_FIELDS.forEach(function (f) {
      state.reorderEnabled[f] = enabledList.indexOf(f) >= 0;
    });

    // Enabled fields first (in preset order), then the rest
    var ordered = enabledList.slice();
    ALL_FIELDS.forEach(function (f) {
      if (ordered.indexOf(f) < 0) ordered.push(f);
    });
    state.reorderFields = ordered;
    state.reorderPreset = name;
    saveState();

    rebuildFieldRows();
    syncPresetBtns();
    syncSepBtns();
    refresh();
  }

  /* ======== Register mode ======== */
  App.App.registerMode({
    id: 'reorder',
    label: 'V2 Reorder',
    run: function (text) {
      if (!panelBuilt) buildPanel();

      // "Original" preset: auto-detect fields present in the input
      if (state.reorderPreset === 'original') {
        state.reorderEnabled = detectPresentFields(text);
        saveState();
        if (panelBuilt) syncFieldRows();
      }

      updatePreview();

      var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var line = processLine(rows[i]);
        if (line) out.push(line);
      }
      return out.join('\n');
    }
  });
})();
