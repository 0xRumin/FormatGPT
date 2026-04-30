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

  // Find & Replace — applied to each row before classification, so users can
  // normalize wonky inputs (e.g. ; → :) without editing the input box.
  if (typeof state.reorderFindStr !== 'string') {
    var savedFind = localStorage.getItem('reorderFindStr');
    state.reorderFindStr = savedFind == null ? '' : savedFind;
  }
  if (typeof state.reorderReplStr !== 'string') {
    var savedRepl = localStorage.getItem('reorderReplStr');
    state.reorderReplStr = savedRepl == null ? '' : savedRepl;
  }

  // Field Swap — purely positional ops (swap/move/delete). Intentionally NOT
  // persisted: the queue resets on every page load so a stale "Delete pos 4"
  // doesn't quietly mangle tomorrow's input. In-memory only.
  state.reorderFieldOps = [];
  try { localStorage.removeItem('reorderFieldOps'); } catch (e) {}

  function saveState() {
    localStorage.setItem('reorderFields', JSON.stringify(state.reorderFields));
    localStorage.setItem('reorderEnabled', JSON.stringify(state.reorderEnabled));
    localStorage.setItem('reorderSep', state.reorderSep);
    localStorage.setItem('reorderPreset', state.reorderPreset);
    localStorage.setItem('reorderFindStr', state.reorderFindStr || '');
    localStorage.setItem('reorderReplStr', state.reorderReplStr || '');
    // reorderFieldOps is intentionally session-only — never written.
  }

  function applyFindReplace(s) {
    var find = state.reorderFindStr || '';
    if (!find) return s;
    // Plain string replace-all (split/join), no regex surprises.
    return String(s).split(find).join(state.reorderReplStr || '');
  }

  function applyFieldOps(parts) {
    var arr = parts.slice();
    var ops = state.reorderFieldOps || [];
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      var a = o.a, b = o.b;
      if (o.op === 'swap') {
        if (a >= 0 && b >= 0 && a < arr.length && b < arr.length && a !== b) {
          var t = arr[a]; arr[a] = arr[b]; arr[b] = t;
        }
      } else if (o.op === 'move') {
        if (a >= 0 && b >= 0 && a < arr.length && b < arr.length && a !== b) {
          var x = arr.splice(a, 1)[0];
          arr.splice(b, 0, x);
        }
      } else if (o.op === 'delete') {
        if (a >= 0 && a < arr.length) arr.splice(a, 1);
      }
    }
    return arr;
  }

  function describeOp(o) {
    var a1 = (o.a | 0) + 1, b1 = (o.b | 0) + 1;
    if (o.op === 'swap')   return 'Swap ' + a1 + ' ↔ ' + b1;
    if (o.op === 'move')   return 'Move ' + a1 + ' → ' + b1;
    if (o.op === 'delete') return 'Delete ' + a1;
    return '?';
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
      var parts = U.splitFlexible(applyFindReplace(rows[r]));
      var classified = classifyParts(parts);
      for (var type in classified) foundTypes[type] = true;
    }
    var enabled = {};
    ALL_FIELDS.forEach(function (f) { enabled[f] = !!foundTypes[FIELD_TO_TYPE[f]]; });
    return enabled;
  }

  /* ======== Process one line ======== */
  function processLine(row) {
    var sep = state.reorderSep || ':';
    var parts = U.splitFlexible(applyFindReplace(row));

    // Field Swap mode — purely positional, bypasses classification.
    var ops = state.reorderFieldOps || [];
    if (ops.length > 0) {
      return applyFieldOps(parts).join(sep);
    }

    // Smart classification mode (default).
    var classified = classifyParts(parts);
    var result = [];
    var fields  = state.reorderFields  || ALL_FIELDS;
    var enabled = state.reorderEnabled || {};

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

    // Find & Replace
    var fAttr = (state.reorderFindStr || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    var rAttr = (state.reorderReplStr || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    h += '<div class="rp-section"><div class="rp-label">FIND &amp; REPLACE</div>';
    h += '<div class="rp-fr" id="rpFr">';
    h += '<input type="text" class="rp-fr-input" id="rpFrFind" placeholder="Find (e.g. ;)" value="' + fAttr + '" spellcheck="false" autocomplete="off">';
    h += '<span class="rp-fr-arrow">→</span>';
    h += '<input type="text" class="rp-fr-input" id="rpFrRepl" placeholder="Replace (e.g. :)" value="' + rAttr + '" spellcheck="false" autocomplete="off">';
    h += '<button type="button" class="rp-fr-clear" id="rpFrClear" title="Clear find &amp; replace">✕</button>';
    h += '</div>';
    h += '<div class="rp-fr-hint" id="rpFrHint">Plain text replace, applied to every row before parsing.</div>';
    h += '</div>';

    // Fields & Order
    h += '<div class="rp-section"><div class="rp-label">FIELDS & ORDER';
    h += '<span class="rp-sel-acts"><a href="#" id="rpSelectAll">Select all</a> / <a href="#" id="rpDeselectAll">Deselect all</a></span>';
    h += '</div><div class="rp-fields" id="rpFields">';
    h += buildFieldRows();
    h += '</div></div>';

    // Field Swap (positional ops sub-module)
    h += '<div class="rp-section"><div class="rp-label">FIELD SWAP <span class="rp-fs-mode" id="rpFsMode">' +
         (state.reorderFieldOps && state.reorderFieldOps.length ? 'positional override active' : 'optional / 1-indexed') +
         '</span></div>';
    h += '<div class="rp-fs-add">';
    h += '<div class="rp-fs-dd" id="rpFsDd" data-value="swap">';
    h += '  <button type="button" class="rp-fs-dd-btn" id="rpFsOpBtn" aria-haspopup="listbox" aria-expanded="false">';
    h += '    <span class="rp-fs-dd-label" id="rpFsOpLabel">Swap</span>';
    h += '    <svg class="rp-fs-dd-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
    h += '  </button>';
    h += '  <ul class="rp-fs-dd-menu" id="rpFsOpMenu" role="listbox">';
    h += '    <li class="rp-fs-dd-item active" data-value="swap"   role="option" aria-selected="true">Swap</li>';
    h += '    <li class="rp-fs-dd-item"        data-value="move"   role="option">Move</li>';
    h += '    <li class="rp-fs-dd-item"        data-value="delete" role="option">Delete</li>';
    h += '  </ul>';
    h += '</div>';
    h += '<input type="number" min="1" class="rp-fs-num" id="rpFsP1" placeholder="Pos">';
    h += '<input type="number" min="1" class="rp-fs-num" id="rpFsP2" placeholder="Pos">';
    h += '<button type="button" class="rp-fs-add-btn" id="rpFsAdd">Apply</button>';
    h += '</div>';
    h += '<div class="rp-fs-list" id="rpFsList">' + buildFieldOpRows() + '</div>';
    h += '<div class="rp-fs-hint">When at least one op is queued, output is built positionally — smart classification is bypassed.</div>';
    h += '</div>';

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

  function buildFieldOpRows() {
    var ops = state.reorderFieldOps || [];
    if (!ops.length) return '<div class="rp-fs-empty">No operations \u2014 pick Swap / Move / Delete and hit Apply.</div>';
    var h = '';
    for (var i = 0; i < ops.length; i++) {
      h += '<div class="rp-fs-item" data-idx="' + i + '">';
      h += '<span class="rp-fs-num-tag">' + (i + 1) + '</span>';
      h += '<span class="rp-fs-desc">' + describeOp(ops[i]) + '</span>';
      h += '<button type="button" class="rp-fs-del" title="Remove">\u00d7</button>';
      h += '</div>';
    }
    return h;
  }

  function rebuildFieldOpRows() {
    var c = $('#rpFsList');
    if (c) c.innerHTML = buildFieldOpRows();
    var modeTag = $('#rpFsMode');
    if (modeTag) modeTag.textContent = (state.reorderFieldOps && state.reorderFieldOps.length)
      ? 'positional override active'
      : 'optional / 1-indexed';
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

    // Find & Replace
    var frFind = $('#rpFrFind');
    var frRepl = $('#rpFrRepl');
    var frClear = $('#rpFrClear');
    function commitFr() {
      state.reorderFindStr = frFind ? frFind.value : '';
      state.reorderReplStr = frRepl ? frRepl.value : '';
      saveState();
      // If "Original" preset is active, the field-presence detection depends
      // on the post-replacement text — re-run it so toggles update.
      if (state.reorderPreset === 'original') {
        var inp = $('#inp');
        var text = inp ? inp.value : '';
        state.reorderEnabled = detectPresentFields(text);
        syncFieldRows();
      }
      refresh();
    }
    if (frFind) frFind.addEventListener('input', commitFr);
    if (frRepl) frRepl.addEventListener('input', commitFr);
    if (frClear) frClear.addEventListener('click', function () {
      if (frFind) frFind.value = '';
      if (frRepl) frRepl.value = '';
      commitFr();
      if (frFind) frFind.focus();
    });

    // Field Swap
    var fsDd       = $('#rpFsDd');
    var fsOpBtn    = $('#rpFsOpBtn');
    var fsOpLabel  = $('#rpFsOpLabel');
    var fsOpMenu   = $('#rpFsOpMenu');
    var fsP1       = $('#rpFsP1');
    var fsP2       = $('#rpFsP2');
    var fsAdd      = $('#rpFsAdd');
    var fsList     = $('#rpFsList');

    function getFsOp() { return (fsDd && fsDd.dataset.value) || 'swap'; }

    function setFsOp(val, labelText) {
      if (!fsDd) return;
      fsDd.dataset.value = val;
      if (fsOpLabel && labelText) fsOpLabel.textContent = labelText;
      // Sync active class on items
      if (fsOpMenu) {
        var items = fsOpMenu.querySelectorAll('.rp-fs-dd-item');
        for (var i = 0; i < items.length; i++) {
          var on = items[i].dataset.value === val;
          items[i].classList.toggle('active', on);
          items[i].setAttribute('aria-selected', on ? 'true' : 'false');
        }
      }
      syncFsP2Visibility();
    }

    function openFsMenu(open) {
      if (!fsDd || !fsOpBtn) return;
      fsDd.classList.toggle('open', !!open);
      fsOpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function syncFsP2Visibility() {
      if (!fsP2) return;
      var hide = getFsOp() === 'delete';
      fsP2.style.visibility = hide ? 'hidden' : 'visible';
      if (hide) fsP2.value = '';
    }
    syncFsP2Visibility();

    if (fsOpBtn) fsOpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openFsMenu(!fsDd.classList.contains('open'));
    });
    if (fsOpMenu) fsOpMenu.addEventListener('click', function (e) {
      var item = e.target.closest('.rp-fs-dd-item');
      if (!item) return;
      setFsOp(item.dataset.value, item.textContent.trim());
      openFsMenu(false);
    });
    document.addEventListener('click', function (e) {
      if (!fsDd) return;
      if (fsDd.classList.contains('open') && !fsDd.contains(e.target)) openFsMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') openFsMenu(false);
    });

    if (fsAdd) fsAdd.addEventListener('click', function () {
      var op = getFsOp();
      var p1 = parseInt(fsP1 ? fsP1.value : '', 10);
      var p2 = parseInt(fsP2 ? fsP2.value : '', 10);
      if (!isFinite(p1) || p1 < 1) {
        if (fsP1) { fsP1.focus(); fsP1.style.borderColor = '#e84855'; setTimeout(function(){fsP1.style.borderColor='';}, 800); }
        return;
      }
      if (op !== 'delete') {
        if (!isFinite(p2) || p2 < 1) {
          if (fsP2) { fsP2.focus(); fsP2.style.borderColor = '#e84855'; setTimeout(function(){fsP2.style.borderColor='';}, 800); }
          return;
        }
        if (p1 === p2) {
          if (fsP2) { fsP2.focus(); fsP2.style.borderColor = '#e84855'; setTimeout(function(){fsP2.style.borderColor='';}, 800); }
          return;
        }
      }
      var entry = { op: op, a: p1 - 1, b: (op === 'delete' ? null : p2 - 1) };
      state.reorderFieldOps = (state.reorderFieldOps || []).concat([entry]);
      saveState();
      if (fsP1) fsP1.value = '';
      if (fsP2) fsP2.value = '';
      rebuildFieldOpRows();
      refresh();
    });

    if (fsList) fsList.addEventListener('click', function (e) {
      var btn = e.target.closest('.rp-fs-del');
      if (!btn) return;
      var item = btn.closest('.rp-fs-item');
      if (!item) return;
      var idx = parseInt(item.dataset.idx, 10);
      if (!isFinite(idx)) return;
      state.reorderFieldOps.splice(idx, 1);
      saveState();
      rebuildFieldOpRows();
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
