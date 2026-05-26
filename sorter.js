// sorter.js – Universal Data Sorter with auto-detected columns
(function () {
  var U = App.Utils;
  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var panelBuilt = false;

  var TYPE_META = {
    username:      { emoji: '\uD83D\uDC64', name: 'Username' },      // 👤
    email:         { emoji: '\uD83D\uDCE7', name: 'Email' },         // 📧
    phone:         { emoji: '\uD83D\uDCDE', name: 'Phone' },         // 📞
    password:      { emoji: '\uD83D\uDD11', name: 'Password' },      // 🔑
    mail_password: { emoji: '\uD83D\uDD11', name: 'Mail Password' }, // 🔑
    auth_token:    { emoji: '\uD83D\uDD10', name: 'Auth Token' },    // 🔐
    twofa_key:     { emoji: '\uD83D\uDD12', name: '2FA Key' },       // 🔒
    counts:        { emoji: '\uD83D\uDD22', name: 'Counts' },        // 🔢
    year:          { emoji: '\uD83D\uDCC5', name: 'Year' }           // 📅
  };

  /* ======== State defaults ======== */
  if (state.sorterColumn == null || isNaN(state.sorterColumn)) state.sorterColumn = 0;
  if (!state.sorterOrder) state.sorterOrder = 'desc';

  function saveSorterState() {
    localStorage.setItem('sorterColumn', String(state.sorterColumn));
    localStorage.setItem('sorterOrder', state.sorterOrder);
  }

  /* ======== Column type classification ======== */
  function classifyCol(col) {
    col = (col || '').trim();
    if (!col) return null;
    if (col.indexOf('@') > -1 && col.indexOf('.') > -1) return 'email';
    if (/^[0-9a-f]{40}$/i.test(col)) return 'auth_token';
    if (/^[A-Z0-9]{16}$/.test(col)) return 'twofa_key';
    if (/^\+\d/.test(col)) return 'phone';
    if (/^\d{4}$/.test(col) && +col >= 1900 && +col <= 2030) return 'year';
    if (/^\d+$/.test(col)) return 'counts';
    if (col.length >= 8 && col.length <= 25 && !col.startsWith('+')) return 'password';
    return null;
  }

  /* ======== Format detection ======== */
  function detectFormat(lines) {
    if (!lines.length) return null;
    var sample = lines[0];
    if (!sample) return null;

    var firstCols = sample.split(':');
    var totalCols = firstCols.length;
    if (!totalCols) return null;

    // Gather type counts per column across first 5 lines
    var posTypes = {};
    for (var l = 0; l < Math.min(lines.length, 5); l++) {
      if (!lines[l]) continue;
      var cols = lines[l].split(':');
      for (var i = 0; i < cols.length; i++) {
        var t = classifyCol(cols[i]);
        if (!t) continue;
        if (!posTypes[i]) posTypes[i] = {};
        posTypes[i][t] = (posTypes[i][t] || 0) + 1;
      }
    }

    // Pick most-common type per position
    var columnTypes = [];
    var emailPos = -1;
    for (var j = 0; j < totalCols; j++) {
      if (j === 0) { columnTypes.push('username'); continue; }
      var types = posTypes[j] || {};
      var best = null, bestCount = 0;
      for (var tt in types) {
        if (types[tt] > bestCount) { bestCount = types[tt]; best = tt; }
      }
      if (best === 'email') emailPos = j;
      columnTypes.push(best);
    }

    // Column immediately after email -> mail_password
    if (emailPos >= 0 && emailPos + 1 < totalCols && columnTypes[emailPos + 1] === 'password') {
      columnTypes[emailPos + 1] = 'mail_password';
    }

    return { totalColumns: totalCols, columnTypes: columnTypes };
  }

  function colLabel(type, idx) {
    var meta = TYPE_META[type];
    if (meta) return meta.emoji + ' ' + meta.name;
    return '\uD83D\uDCC4 Column ' + (idx + 1);
  }

  /* ======== Panel creation ======== */
  function ensurePanelEl() {
    var panel = $('#sorterPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'sorterPanel';
    panel.className = 'card';
    panel.style.display = 'block';
    var out = $('#out');
    if (out) {
      var card = out.closest('.card');
      if (card) { card.parentNode.insertBefore(panel, card); return panel; }
    }
    document.querySelector('main').appendChild(panel);
    return panel;
  }

  function buildPanel() {
    var panel = ensurePanelEl();
    if (!panel || panelBuilt) return;
    panelBuilt = true;
    panel.style.display = 'block';

    var h = '';

    // Header info
    h += '<div class="sp-info" id="spInfo">';
    h += '<div class="sp-title">\uD83D\uDD04 Sorter</div>';
    h += '<div class="sp-sub" id="spSub">Paste data above to detect columns</div>';
    h += '</div>';

    // Columns
    h += '<div class="sp-section">';
    h += '<div class="sp-label">\uD83D\uDCCB SORT BY COLUMN</div>';
    h += '<div class="sp-cols" id="spCols"></div>';
    h += '</div>';

    // Order
    h += '<div class="sp-section">';
    h += '<div class="sp-label">\uD83D\uDCCA SORT ORDER</div>';
    h += '<div class="sp-orders" id="spOrders">';
    [
      ['desc',    '\u2193 Big \u2192 Small', 'numeric'],
      ['asc',     '\u2191 Small \u2192 Big', 'numeric'],
      ['az',      'A \u2192 Z',              'text'],
      ['za',      'Z \u2192 A',              'text'],
      ['random',  '\uD83C\uDFB2 Random',     ''],
      ['reverse', '\u21C5 Reverse Lines',    '']
    ].forEach(function (o) {
      var cls = state.sorterOrder === o[0] ? ' sp-active' : '';
      h += '<button class="sp-order' + cls + '" data-order="' + o[0] + '">';
      h += '<span class="sp-o-name">' + o[1] + '</span>';
      if (o[2]) h += '<span class="sp-o-hint">' + o[2] + '</span>';
      h += '</button>';
    });
    h += '</div></div>';

    // Year breakdown (hidden until Year column is selected)
    h += '<div class="sp-breakdown" id="spBreakdown" style="display:none">';
    h += '<div class="sp-label">📅 YEAR BREAKDOWN</div>';
    h += '<div class="sp-bd-body" id="spBdBody"></div>';
    h += '</div>';

    panel.innerHTML = h;
    bindEvents();
  }

  /* ======== Events ======== */
  function bindEvents() {
    $('#spCols').addEventListener('click', function (e) {
      var btn = e.target.closest('.sp-col');
      if (!btn) return;
      state.sorterColumn = +btn.dataset.col;
      saveSorterState();
      syncColBtns();
      App.App.rerun();
    });

    $('#spOrders').addEventListener('click', function (e) {
      var btn = e.target.closest('.sp-order');
      if (!btn) return;
      state.sorterOrder = btn.dataset.order;
      saveSorterState();
      syncOrderBtns();
      App.App.rerun();
    });
  }

  /* ======== UI sync ======== */
  function renderCols(format) {
    var wrap = $('#spCols');
    var sub = $('#spSub');
    if (!wrap) return;

    if (!format || !format.columnTypes.length) {
      wrap.innerHTML = '<div class="sp-cols-empty">Paste data above to detect columns\u2026</div>';
      if (sub) sub.textContent = 'Paste data above to detect columns';
      return;
    }

    if (sub) sub.textContent = 'Detected ' + format.totalColumns + ' columns';

    wrap.innerHTML = format.columnTypes.map(function (t, i) {
      var cls = state.sorterColumn === i ? ' sp-active' : '';
      return '<button class="sp-col' + cls + '" data-col="' + i + '">' +
             '<span class="sp-col-num">' + (i + 1) + '</span>' +
             '<span class="sp-col-name">' + colLabel(t, i) + '</span>' +
             '</button>';
    }).join('');
  }

  function syncColBtns() {
    var btns = document.querySelectorAll('#spCols .sp-col');
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle('sp-active', +btns[i].dataset.col === state.sorterColumn);
  }

  function syncOrderBtns() {
    var btns = document.querySelectorAll('#spOrders .sp-order');
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle('sp-active', btns[i].dataset.order === state.sorterOrder);
  }

  /* ======== Year breakdown ======== */
  function renderBreakdown(rows, format) {
    var wrap = $('#spBreakdown');
    var body = $('#spBdBody');
    if (!wrap || !body) return;

    var colType = format.columnTypes[state.sorterColumn];
    if (colType !== 'year' && colType !== 'counts') {
      wrap.style.display = 'none';
      return;
    }

    // Count per value
    var counts = {};
    var totalCols = format.totalColumns;
    var col = state.sorterColumn;
    for (var i = 0; i < rows.length; i++) {
      var parts = rows[i].split(':');
      if (parts.length !== totalCols) continue;
      var val = (parts[col] || '').trim();
      if (!val) continue;
      counts[val] = (counts[val] || 0) + 1;
    }

    var keys = Object.keys(counts);
    if (!keys.length) { wrap.style.display = 'none'; return; }

    // Sort keys: years descending, counts descending by count
    if (colType === 'year') {
      keys.sort(function (a, b) { return +b - +a; });
    } else {
      keys.sort(function (a, b) { return counts[b] - counts[a]; });
    }

    var max = 0;
    for (var k = 0; k < keys.length; k++) {
      if (counts[keys[k]] > max) max = counts[keys[k]];
    }

    var total = rows.length;
    var h = '<div class="sp-bd-total">' + keys.length + ' unique values · ' + total + ' accounts</div>';
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var cnt = counts[key];
      var pct = max > 0 ? Math.round((cnt / max) * 100) : 0;
      var pctTotal = total > 0 ? ((cnt / total) * 100).toFixed(1) : '0';
      h += '<div class="sp-bd-row">';
      h += '<span class="sp-bd-key">' + key + '</span>';
      h += '<div class="sp-bd-bar-wrap"><div class="sp-bd-bar" style="width:' + pct + '%"></div></div>';
      h += '<span class="sp-bd-count">' + cnt + '</span>';
      h += '<span class="sp-bd-pct">' + pctTotal + '%</span>';
      h += '</div>';
    }

    body.innerHTML = h;
    wrap.style.display = 'block';
  }

  /* ======== Sort logic ======== */
  function sortLines(lines, format) {
    var totalCols = format.totalColumns;
    var colTypes = format.columnTypes;
    var sortBy = state.sorterColumn;
    var order = state.sorterOrder;

    // Parse
    var parsed = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      var cols = lines[i].split(':');
      if (cols.length === totalCols) parsed.push(cols);
      // mismatched column counts are skipped silently
    }

    if (order === 'random') {
      // Fisher-Yates
      for (var j = parsed.length - 1; j > 0; j--) {
        var k = Math.floor(Math.random() * (j + 1));
        var tmp = parsed[j]; parsed[j] = parsed[k]; parsed[k] = tmp;
      }
    } else if (order === 'reverse') {
      parsed.reverse();
    } else {
      var colType = colTypes[sortBy] || '';
      var isNumeric = (colType === 'counts' || colType === 'year');
      var reverse = (order === 'desc' || order === 'za');

      parsed.sort(function (a, b) {
        var av = a[sortBy] || '';
        var bv = b[sortBy] || '';
        if (isNumeric) {
          var an = parseInt(av, 10); if (isNaN(an)) an = reverse ? -Infinity : Infinity;
          var bn = parseInt(bv, 10); if (isNaN(bn)) bn = reverse ? -Infinity : Infinity;
          return reverse ? bn - an : an - bn;
        }
        var al = av.toLowerCase(), bl = bv.toLowerCase();
        if (al < bl) return reverse ? 1 : -1;
        if (al > bl) return reverse ? -1 : 1;
        return 0;
      });
    }

    return parsed.map(function (r) { return r.join(':'); });
  }

  /* ======== Register mode ======== */
  App.App.registerMode({
    id: 'sorter',
    label: 'Sorter',
    run: function (text) {
      if (!panelBuilt) buildPanel();

      var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!rows.length) {
        renderCols(null);
        var bd = $('#spBreakdown'); if (bd) bd.style.display = 'none';
        return '';
      }

      var format = detectFormat(rows);
      if (!format) { renderCols(null); return ''; }

      // Clamp column index
      if (state.sorterColumn >= format.totalColumns) {
        state.sorterColumn = 0;
        saveSorterState();
      }

      renderCols(format);
      renderBreakdown(rows, format);
      var sorted = sortLines(rows, format);
      return sorted.join('\n');
    }
  });
})();
