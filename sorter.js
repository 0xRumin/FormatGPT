// sorter.js – Universal Data Sorter with auto-detected columns
(function () {
  var U = App.Utils;
  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var panelBuilt = false;
  var lastFormat = null;
  var lastSortCol = -1;
  var excludedYears = {};
  var excludedRanges = {}; // counts ranges excluded from output: { 'lo – hi': {lo,hi} }
  var tabGroups = {}; // { 'key': ['full:line:1', ...], ... }
  var mismatchLines = []; // raw input lines whose column count != detected total
  var lastRows = [];
  var rangeSelection = { kind: null, lo: null, hi: null };

  var TYPE_META = {
    username:      { emoji: '\uD83D\uDC64', name: 'Username' },      // 👤
    email:         { emoji: '\uD83D\uDCE7', name: 'Email' },         // 📧
    mail_bundle:   { emoji: '\uD83D\uDCE6', name: 'Mail Bundle' },   // 📦 mail|pass|refresh|clientID
    phone:         { emoji: '\uD83D\uDCDE', name: 'Phone' },         // 📞
    password:      { emoji: '\uD83D\uDD11', name: 'Password' },      // 🔑
    mail_password: { emoji: '\uD83D\uDD11', name: 'Mail Password' }, // 🔑
    ct0:           { emoji: '\uD83E\uDDE9', name: 'ct0' },           // 🧩
    auth_token:    { emoji: '\uD83D\uDD10', name: 'Auth Token' },    // 🔐
    twofa_key:     { emoji: '\uD83D\uDD12', name: '2FA Key' },       // 🔒
    counts:        { emoji: '\uD83D\uDD22', name: 'Counts' },        // 🔢
    year:          { emoji: '\uD83D\uDCC5', name: 'Year' }           // 📅
  };

  /* ======== State defaults ======== */
  if (state.sorterColumn == null || isNaN(state.sorterColumn)) state.sorterColumn = 0;
  if (!state.sorterOrder) state.sorterOrder = 'desc';
  if (state.sorterForce == null) state.sorterForce = false;

  function saveSorterState() {
    localStorage.setItem('sorterColumn', String(state.sorterColumn));
    localStorage.setItem('sorterOrder', state.sorterOrder);
    localStorage.setItem('sorterForce', state.sorterForce ? '1' : '0');
  }

  function downloadTxt(lines, filename) {
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function clamp(n, min, max) {
    n = parseInt(n, 10);
    if (isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function fmtNum(n) {
    try { return Number(n).toLocaleString(); } catch (e) { return String(n); }
  }

  function fmtRangeValue(n, kind) {
    return kind === 'year' ? String(n) : fmtNum(n);
  }

  function cleanFilePart(s) {
    return String(s || '').replace(/[^A-Za-z0-9_\-.]+/g, '-').replace(/^-+|-+$/g, '') || 'range';
  }

  /* ======== Column type classification ======== */
  function classifyCol(col) {
    col = (col || '').trim();
    if (!col) return null;
    // Pipe-mail-bundle: mail|mailpass|refresh_token|clientID. Detect BEFORE the
    // plain-email check so the whole chunk isn't mislabeled as "Email".
    if (col.indexOf('|') > -1) {
      var first = col.split('|')[0];
      if (first.indexOf('@') > -1 && first.indexOf('.') > -1) return 'mail_bundle';
    }
    if (col.indexOf('@') > -1 && col.indexOf('.') > -1) return 'email';
    if (/^[0-9a-f]{160}$/i.test(col)) return 'ct0';
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

    // Determine the dominant column count from the WHOLE dataset instead of
    // trusting line 1. Every line's colon-field count casts a vote; the most
    // common count wins. This stops an atypical first line (a stray colon, a
    // missing field) from mislabeling the entire set and silently dropping
    // every "normal" row. Ties resolve to the earliest-seen count.
    var freq = {};
    var seenOrder = [];
    for (var a = 0; a < lines.length; a++) {
      if (!lines[a]) continue;
      var n = lines[a].split(':').length;
      if (freq[n] == null) { freq[n] = 0; seenOrder.push(n); }
      freq[n]++;
    }
    var totalCols = 0, bestFreq = -1;
    for (var o = 0; o < seenOrder.length; o++) {
      var cand = seenOrder[o];
      if (freq[cand] > bestFreq) { bestFreq = freq[cand]; totalCols = cand; }
    }
    if (!totalCols) return null;

    // Gather type counts per column across the first 5 lines that MATCH the
    // dominant column count, so classification is based on representative rows.
    var posTypes = {};
    var sampled = 0;
    for (var l = 0; l < lines.length && sampled < 5; l++) {
      if (!lines[l]) continue;
      var cols = lines[l].split(':');
      if (cols.length !== totalCols) continue;
      sampled++;
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

    // Breakdown (hidden until Year or Counts column is selected)
    h += '<div class="sp-breakdown" id="spBreakdown" style="display:none">';
    h += '<div class="sp-label" id="spBdLabel">📅 YEAR BREAKDOWN</div>';
    h += '<div class="sp-bd-body" id="spBdBody"></div>';
    h += '</div>';

    // Range download (hidden until Year or Counts column is selected)
    h += '<div class="sp-range-panel" id="spRangePanel" style="display:none"></div>';

    // Year tabs (hidden until Year column selected)
    h += '<div class="sp-tabs-wrap" id="spTabsWrap" style="display:none">';
    h += '<div class="sp-tabs-bar" id="spTabsBar"></div>';
    h += '<div class="sp-tabs-content" id="spTabsContent"></div>';
    h += '</div>';

    // Skipped / mismatched lines (hidden unless some rows don't match the
    // detected column count). Read-only text box so the exact dropped lines
    // are visible and copyable/savable.
    h += '<div class="sp-mismatch" id="spMismatch" style="display:none">';
    h += '<div class="sp-mm-head">';
    h += '<div class="sp-label" id="spMmLabel">⚠️ SKIPPED LINES</div>';
    h += '<div class="sp-mm-actions">';
    h += '<button class="sp-mm-force" id="spMmForce" title="Add these lines to the sort pool and sort them with the rest">Force into sort</button>';
    h += '<button class="sp-mm-copy" id="spMmCopy">Copy</button>';
    h += '<button class="sp-mm-save" id="spMmSave">Save .txt</button>';
    h += '</div></div>';
    h += '<div class="sp-mm-sub" id="spMmSub"></div>';
    h += '<textarea class="sp-mm-box" id="spMmBox" readonly spellcheck="false"></textarea>';
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
      excludedYears = {};
      excludedRanges = {};
      rangeSelection = { kind: null, lo: null, hi: null };
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

    // Breakdown: Remove + Download buttons (event delegation)
    $('#spBdBody').addEventListener('click', function (e) {
      var btn = e.target.closest('.sp-bd-remove, .sp-bd-download');
      if (!btn) return;
      if (!lastFormat) return;
      var isDownload = btn.classList.contains('sp-bd-download');
      var col = lastSortCol;
      var totalCols = lastFormat.totalColumns;

      // Counts row carries a range (data-lo / data-hi); Year row carries a
      // single value (data-year). Handle the range case first.
      if (btn.dataset.lo != null && btn.dataset.hi != null) {
        var lo = parseInt(btn.dataset.lo, 10);
        var hi = parseInt(btn.dataset.hi, 10);
        var rLabel = btn.dataset.label;
        if (isDownload) {
          var inpR = $('#inp'); if (!inpR) return;
          var rowsR = inpR.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
          var matchR = [];
          for (var ir = 0; ir < rowsR.length; ir++) {
            var pR = rowsR[ir].split(':');
            if (pR.length !== totalCols) continue;
            var nvR = parseInt((pR[col] || '').trim(), 10);
            if (!isNaN(nvR) && nvR >= lo && nvR <= hi) matchR.push(rowsR[ir]);
          }
          if (!matchR.length) return;
          downloadTxt(matchR, 'count_' + lo + '-' + hi + '_' + U.randToken(5) + '.txt');
        } else {
          if (excludedRanges[rLabel]) delete excludedRanges[rLabel];
          else excludedRanges[rLabel] = { lo: lo, hi: hi };
          App.App.rerun();
        }
        return;
      }

      // Year value row
      var yearVal = btn.dataset.year;
      if (!yearVal) return;
      if (isDownload) {
        var inp = $('#inp'); if (!inp) return;
        var rows = inp.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
        var matching = [];
        for (var i = 0; i < rows.length; i++) {
          var parts = rows[i].split(':');
          if (parts.length === totalCols && (parts[col] || '').trim() === yearVal) {
            matching.push(rows[i]);
          }
        }
        if (!matching.length) return;
        downloadTxt(matching, 'year_' + yearVal + '_' + U.randToken(5) + '.txt');
      } else {
        // Toggle exclusion from output (input stays untouched)
        if (excludedYears[yearVal]) delete excludedYears[yearVal];
        else excludedYears[yearVal] = true;
        App.App.rerun();
      }
    });

    // Year tabs: switch + copy
    $('#spTabsBar').addEventListener('click', function (e) {
      var tab = e.target.closest('.sp-tab');
      if (!tab) return;
      activateTab(tab.dataset.year);
    });

    $('#spTabsContent').addEventListener('click', function (e) {
      var btn = e.target.closest('.sp-tab-copy');
      if (!btn) return;
      var yr = btn.dataset.year;
      var lines = tabGroups[yr];
      if (!lines || !lines.length) return;
      navigator.clipboard.writeText(lines.join('\n')).then(function () {
        var orig = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = orig; }, 900);
      }).catch(function () { alert('Copy failed.'); });
    });

    $('#spTabsContent').addEventListener('click', function (e) {
      var btn = e.target.closest('.sp-tab-save');
      if (!btn) return;
      var yr = btn.dataset.year;
      var lines = tabGroups[yr];
      if (!lines || !lines.length) return;
      var token = U.randToken(5);
      var prefix = btn.dataset.prefix || 'data_' + yr.replace(/\s+/g, '').replace(/–/g, '-');
      var filename = prefix + '_' + token + '.txt';
      var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
    });

    var rangePanel = $('#spRangePanel');
    if (rangePanel) {
      rangePanel.addEventListener('input', function (e) {
        var t = e.target;
        if (!t || !t.matches('.sp-range-native, .sp-range-num')) return;
        updateRangeSelection(t);
      });

      rangePanel.addEventListener('click', function (e) {
        var btn = e.target.closest('.sp-range-copy, .sp-range-download');
        if (!btn || !lastFormat) return;
        var lo = parseInt(rangePanel.dataset.lo, 10);
        var hi = parseInt(rangePanel.dataset.hi, 10);
        if (isNaN(lo) || isNaN(hi)) return;
        var lines = collectRangeLines(lastRows, lastFormat, lo, hi);
        if (!lines.length) return;

        if (btn.classList.contains('sp-range-copy')) {
          navigator.clipboard.writeText(lines.join('\n')).then(function () {
            var orig = btn.textContent;
            btn.textContent = 'Copied';
            setTimeout(function () { btn.textContent = orig; }, 900);
          }).catch(function () { alert('Copy failed.'); });
        } else {
          var kind = lastFormat.columnTypes[state.sorterColumn] === 'year' ? 'years' : 'counts';
          downloadTxt(lines, kind + '_' + cleanFilePart(lo + '-' + hi) + '_' + U.randToken(5) + '.txt');
        }
      });
    }

    // Force toggle: include column-mismatched lines in the sort pool.
    var mmForce = $('#spMmForce');
    if (mmForce) mmForce.addEventListener('click', function () {
      state.sorterForce = !state.sorterForce;
      saveSorterState();
      App.App.rerun();
    });

    // Skipped-lines box: Copy + Save operate on the raw (unannotated) lines.
    var mmCopy = $('#spMmCopy');
    if (mmCopy) mmCopy.addEventListener('click', function () {
      if (!mismatchLines.length) return;
      navigator.clipboard.writeText(mismatchLines.join('\n')).then(function () {
        var orig = mmCopy.textContent;
        mmCopy.textContent = 'Copied';
        setTimeout(function () { mmCopy.textContent = orig; }, 900);
      }).catch(function () { alert('Copy failed.'); });
    });

    var mmSave = $('#spMmSave');
    if (mmSave) mmSave.addEventListener('click', function () {
      if (!mismatchLines.length) return;
      var token = U.randToken(5);
      var blob = new Blob(['﻿' + mismatchLines.join('\n')], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'skipped_lines_' + token + '.txt';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
    });
  }

  function activateTab(yr) {
    var tabs = document.querySelectorAll('#spTabsBar .sp-tab');
    for (var i = 0; i < tabs.length; i++)
      tabs[i].classList.toggle('sp-tab-active', tabs[i].dataset.year === yr);
    var panes = document.querySelectorAll('#spTabsContent .sp-tab-pane');
    for (var j = 0; j < panes.length; j++)
      panes[j].style.display = panes[j].dataset.year === yr ? 'block' : 'none';
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

  /* ======== Breakdown (Year + Counts) ======== */

  // Pick smart step/ranges based on the max value in the data
  function pickCountRanges(maxVal) {
    var step, ranges = [];
    if (maxVal <= 30)       step = 5;
    else if (maxVal <= 100) step = 10;
    else if (maxVal <= 500) step = 100;
    else if (maxVal <= 2000) step = 250;
    else if (maxVal <= 10000) step = 1000;
    else                     step = 5000;

    for (var lo = 0; lo <= maxVal; lo += step) {
      var hi = lo + step - 1;
      ranges.push({ lo: lo, hi: hi, label: lo + ' – ' + hi });
    }
    return ranges;
  }

  function renderBreakdown(rows, format) {
    var wrap = $('#spBreakdown');
    var body = $('#spBdBody');
    var label = $('#spBdLabel');
    if (!wrap || !body) return;

    var colType = format.columnTypes[state.sorterColumn];
    if (colType !== 'year' && colType !== 'counts') {
      wrap.style.display = 'none';
      var rangePanel = $('#spRangePanel');
      if (rangePanel) rangePanel.style.display = 'none';
      return;
    }

    // Update label
    if (label) {
      label.textContent = colType === 'year'
        ? '📅 YEAR BREAKDOWN'
        : '🔢 COUNTS BREAKDOWN';
    }

    // Collect numeric values
    var totalCols = format.totalColumns;
    var col = state.sorterColumn;
    var values = [];
    for (var i = 0; i < rows.length; i++) {
      var parts = rows[i].split(':');
      if (parts.length !== totalCols) continue;
      var raw = (parts[col] || '').trim();
      if (!raw) continue;
      var num = parseInt(raw, 10);
      if (!isNaN(num)) values.push(num);
    }

    if (!values.length) { wrap.style.display = 'none'; return; }

    var total = values.length;
    var h = '';
    // Graph rows follow the chosen sort direction: ascending orders (Small→Big
    // / A→Z) list smallest values first; everything else lists largest first.
    var asc = (state.sorterOrder === 'asc' || state.sorterOrder === 'az');

    if (colType === 'year') {
      // Year: count per individual year, ordered to match the sort direction
      var yearCounts = {};
      for (var y = 0; y < values.length; y++) {
        var yr = String(values[y]);
        yearCounts[yr] = (yearCounts[yr] || 0) + 1;
      }
      var years = Object.keys(yearCounts).sort(function (a, b) { return asc ? (+a - +b) : (+b - +a); });
      var maxCnt = 0;
      for (var m = 0; m < years.length; m++) {
        if (yearCounts[years[m]] > maxCnt) maxCnt = yearCounts[years[m]];
      }
      h += '<div class="sp-bd-total">' + years.length + ' unique years · ' + total + ' accounts</div>';
      for (var j = 0; j < years.length; j++) {
        var cnt = yearCounts[years[j]];
        var barW = maxCnt > 0 ? Math.round((cnt / maxCnt) * 100) : 0;
        var pctT = ((cnt / total) * 100).toFixed(1);
        h += '<div class="sp-bd-row">';
        h += '<span class="sp-bd-key">' + years[j] + '</span>';
        h += '<div class="sp-bd-bar-wrap"><div class="sp-bd-bar" style="width:' + barW + '%"></div></div>';
        h += '<span class="sp-bd-count">' + cnt + '</span>';
        h += '<span class="sp-bd-pct">' + pctT + '%</span>';
        var isExcl = excludedYears[years[j]] ? ' sp-bd-excluded' : '';
        h += '<button class="sp-bd-remove' + isExcl + '" data-year="' + years[j] + '" title="Remove ' + years[j] + ' from output">' + (excludedYears[years[j]] ? 'Undo' : '✕') + '</button>';
        h += '<button class="sp-bd-download" data-year="' + years[j] + '" title="Download ' + years[j] + ' accounts">Save</button>';
        h += '</div>';
      }
    } else {
      // Counts: smart range grouping
      var maxVal = 0;
      for (var v = 0; v < values.length; v++) {
        if (values[v] > maxVal) maxVal = values[v];
      }

      var ranges = pickCountRanges(maxVal);

      // Tally into ranges
      var rangeCounts = [];
      for (var r = 0; r < ranges.length; r++) rangeCounts.push(0);
      for (var w = 0; w < values.length; w++) {
        for (var ri = 0; ri < ranges.length; ri++) {
          if (values[w] >= ranges[ri].lo && values[w] <= ranges[ri].hi) {
            rangeCounts[ri]++;
            break;
          }
        }
      }

      // Find max count for bar scaling
      var maxRC = 0;
      for (var mc = 0; mc < rangeCounts.length; mc++) {
        if (rangeCounts[mc] > maxRC) maxRC = rangeCounts[mc];
      }

      // Count non-empty ranges
      var nonEmpty = 0;
      for (var ne = 0; ne < rangeCounts.length; ne++) {
        if (rangeCounts[ne] > 0) nonEmpty++;
      }

      h += '<div class="sp-bd-total">' + nonEmpty + ' ranges · ' + total + ' accounts · max ' + maxVal + '</div>';
      // Ranges are built low→high; reverse the display order for descending sorts
      // so the graph mirrors the output (big ranges first on Big→Small).
      var rOrder = [];
      for (var ro = 0; ro < ranges.length; ro++) rOrder.push(ro);
      if (!asc) rOrder.reverse();
      for (var gi = 0; gi < rOrder.length; gi++) {
        var g = rOrder[gi];
        if (rangeCounts[g] === 0) continue;
        var bW = maxRC > 0 ? Math.round((rangeCounts[g] / maxRC) * 100) : 0;
        var pT = ((rangeCounts[g] / total) * 100).toFixed(1);
        var rLabel = ranges[g].label;
        var rlo = ranges[g].lo, rhi = ranges[g].hi;
        var rExcl = excludedRanges[rLabel] ? ' sp-bd-excluded' : '';
        h += '<div class="sp-bd-row">';
        h += '<span class="sp-bd-key">' + rLabel + '</span>';
        h += '<div class="sp-bd-bar-wrap"><div class="sp-bd-bar" style="width:' + bW + '%"></div></div>';
        h += '<span class="sp-bd-count">' + rangeCounts[g] + '</span>';
        h += '<span class="sp-bd-pct">' + pT + '%</span>';
        h += '<button class="sp-bd-remove' + rExcl + '" data-lo="' + rlo + '" data-hi="' + rhi + '" data-label="' + rLabel + '" title="Remove ' + rLabel + ' from output">' + (excludedRanges[rLabel] ? 'Undo' : '✕') + '</button>';
        h += '<button class="sp-bd-download" data-lo="' + rlo + '" data-hi="' + rhi + '" data-label="' + rLabel + '" title="Download ' + rLabel + ' accounts">Save</button>';
        h += '</div>';
      }
    }

    body.innerHTML = h;
    wrap.style.display = 'block';

    // Build tabs for year or counts
    renderRangeDownload(rows, format, colType);
    renderValueTabs(rows, format, colType);
  }

  /* ======== Range download (year + counts) ======== */

  function numericValueForLine(line, format) {
    if (!line || !format) return null;
    var cols = line.split(':');
    if (cols.length !== format.totalColumns && !state.sorterForce) return null;
    var raw = sortValueFor(cols, state.sorterColumn, format.columnTypes);
    var n = parseInt((raw || '').trim(), 10);
    return isNaN(n) ? null : n;
  }

  function collectRangeValues(rows, format) {
    var values = [];
    for (var i = 0; i < rows.length; i++) {
      var n = numericValueForLine(rows[i], format);
      if (n != null) values.push(n);
    }
    return values;
  }

  function collectRangeLines(rows, format, lo, hi) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var n = numericValueForLine(rows[i], format);
      if (n != null && n >= lo && n <= hi) out.push(rows[i]);
    }
    return out;
  }

  function updateRangeSelection(source) {
    var panel = $('#spRangePanel');
    if (!panel) return;
    var min = parseInt(panel.dataset.min, 10);
    var max = parseInt(panel.dataset.max, 10);
    if (isNaN(min) || isNaN(max)) return;

    var loEl = $('#spRangeLo');
    var hiEl = $('#spRangeHi');
    var loNum = $('#spRangeLoNum');
    var hiNum = $('#spRangeHiNum');
    var lo = loEl ? loEl.value : min;
    var hi = hiEl ? hiEl.value : max;
    if (source && (source.id === 'spRangeLoNum' || source.id === 'spRangeLo')) lo = source.value;
    if (source && (source.id === 'spRangeHiNum' || source.id === 'spRangeHi')) hi = source.value;
    if (source && source.id !== 'spRangeLoNum' && loNum) lo = loEl ? loEl.value : loNum.value;
    if (source && source.id !== 'spRangeHiNum' && hiNum) hi = hiEl ? hiEl.value : hiNum.value;

    lo = clamp(lo, min, max);
    hi = clamp(hi, min, max);
    if (lo > hi) {
      if (source && (source.id === 'spRangeLo' || source.id === 'spRangeLoNum')) hi = lo;
      else lo = hi;
    }

    rangeSelection.lo = lo;
    rangeSelection.hi = hi;
    syncRangeDownload();
  }

  function syncRangeDownload() {
    var panel = $('#spRangePanel');
    if (!panel || !lastFormat) return;
    var min = parseInt(panel.dataset.min, 10);
    var max = parseInt(panel.dataset.max, 10);
    if (isNaN(min) || isNaN(max)) return;

    var lo = clamp(rangeSelection.lo, min, max);
    var hi = clamp(rangeSelection.hi, min, max);
    if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
    rangeSelection.lo = lo;
    rangeSelection.hi = hi;
    panel.dataset.lo = String(lo);
    panel.dataset.hi = String(hi);

    var span = Math.max(1, max - min);
    var loPct = Math.max(0, Math.min(100, ((lo - min) / span) * 100));
    var hiPct = Math.max(0, Math.min(100, ((hi - min) / span) * 100));
    var rail = $('#spRangeRail');
    if (rail) {
      rail.style.setProperty('--lo-pct', loPct + '%');
      rail.style.setProperty('--hi-pct', hiPct + '%');
    }

    var loEl = $('#spRangeLo');
    var hiEl = $('#spRangeHi');
    var loNum = $('#spRangeLoNum');
    var hiNum = $('#spRangeHiNum');
    if (loEl) loEl.value = String(lo);
    if (hiEl) hiEl.value = String(hi);
    if (loNum && document.activeElement !== loNum) loNum.value = String(lo);
    if (hiNum && document.activeElement !== hiNum) hiNum.value = String(hi);

    var lines = collectRangeLines(lastRows, lastFormat, lo, hi);
    var colKind = lastFormat.columnTypes[state.sorterColumn] === 'year' ? 'year' : 'counts';
    var type = colKind === 'year' ? 'years' : 'counts';
    var noun = lines.length === 1 ? 'account' : 'accounts';
    var selected = $('#spRangeSelected');
    var count = $('#spRangeCount');
    if (selected) selected.textContent = fmtRangeValue(lo, colKind) + ' -> ' + fmtRangeValue(hi, colKind);
    if (count) count.textContent = fmtNum(lines.length) + ' ' + noun + ' in selected ' + type + ' range';

    var copy = $('#spRangeCopy');
    var dl = $('#spRangeDownload');
    if (copy) copy.disabled = !lines.length;
    if (dl) dl.disabled = !lines.length;
  }

  function renderRangeDownload(rows, format, colType) {
    var panel = $('#spRangePanel');
    if (!panel) return;
    if (colType !== 'year' && colType !== 'counts') {
      panel.style.display = 'none';
      return;
    }

    var values = collectRangeValues(rows, format);
    if (!values.length) {
      panel.style.display = 'none';
      return;
    }

    var min = values[0], max = values[0];
    for (var i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }

    if (rangeSelection.kind !== colType) {
      rangeSelection.kind = colType;
      rangeSelection.lo = min;
      rangeSelection.hi = max;
    }
    rangeSelection.lo = clamp(rangeSelection.lo, min, max);
    rangeSelection.hi = clamp(rangeSelection.hi, min, max);
    if (rangeSelection.lo > rangeSelection.hi) rangeSelection.hi = rangeSelection.lo;

    var title = colType === 'year' ? 'YEAR RANGE DOWNLOAD' : 'COUNTS / FOLLOWERS RANGE DOWNLOAD';
    var icon = colType === 'year' ? '📅 ' : '🔢 ';
    var hint = colType === 'year' ? 'Select first and final year' : 'Select low and high count';
    var disabled = min === max ? ' disabled' : '';
    var h = '';
    h += '<div class="sp-range-head">';
    h += '<div><div class="sp-label">' + icon + title + '</div>';
    h += '<div class="sp-range-sub">' + hint + ' · source min ' + fmtRangeValue(min, colType) + ' / max ' + fmtRangeValue(max, colType) + '</div></div>';
    h += '<div class="sp-range-pill" id="spRangeSelected"></div>';
    h += '</div>';
    h += '<div class="sp-range-rail" id="spRangeRail">';
    h += '<span class="sp-range-knob sp-range-knob--lo" aria-hidden="true"><span></span><span></span><span></span></span>';
    h += '<span class="sp-range-knob sp-range-knob--hi" aria-hidden="true"><span></span><span></span><span></span></span>';
    h += '<input class="sp-range-native sp-range-native--lo" id="spRangeLo" type="range" min="' + min + '" max="' + max + '" step="1" value="' + rangeSelection.lo + '"' + disabled + '>';
    h += '<input class="sp-range-native sp-range-native--hi" id="spRangeHi" type="range" min="' + min + '" max="' + max + '" step="1" value="' + rangeSelection.hi + '"' + disabled + '>';
    h += '</div>';
    h += '<div class="sp-range-fields">';
    h += '<label><span>From</span><input class="sp-range-num" id="spRangeLoNum" type="number" min="' + min + '" max="' + max + '" step="1" value="' + rangeSelection.lo + '"></label>';
    h += '<label><span>To</span><input class="sp-range-num" id="spRangeHiNum" type="number" min="' + min + '" max="' + max + '" step="1" value="' + rangeSelection.hi + '"></label>';
    h += '<div class="sp-range-count" id="spRangeCount"></div>';
    h += '<div class="sp-range-actions">';
    h += '<button class="sp-range-copy" id="spRangeCopy" type="button">Copy</button>';
    h += '<button class="sp-range-download" id="spRangeDownload" type="button">Download</button>';
    h += '</div></div>';

    panel.dataset.min = String(min);
    panel.dataset.max = String(max);
    panel.innerHTML = h;
    panel.style.display = 'block';
    syncRangeDownload();
  }

  /* ======== Value tabs (year + counts) ======== */
  function renderValueTabs(rows, format, colType) {
    var tabsWrap = $('#spTabsWrap');
    if (!tabsWrap) return;

    if (colType !== 'year' && colType !== 'counts') {
      tabsWrap.style.display = 'none';
      tabGroups = {};
      return;
    }

    var totalCols = format.totalColumns;
    var col = state.sorterColumn;
    tabGroups = {};

    if (colType === 'year') {
      // Group by individual year
      for (var i = 0; i < rows.length; i++) {
        var parts = rows[i].split(':');
        if (parts.length !== totalCols) continue;
        var yr = (parts[col] || '').trim();
        if (!yr || !/^\d{4}$/.test(yr)) continue;
        if (!tabGroups[yr]) tabGroups[yr] = [];
        tabGroups[yr].push(rows[i]);
      }
    } else {
      // Group by count ranges
      var maxVal = 0;
      for (var m = 0; m < rows.length; m++) {
        var mp = rows[m].split(':');
        if (mp.length !== totalCols) continue;
        var mv = parseInt((mp[col] || '').trim(), 10);
        if (!isNaN(mv) && mv > maxVal) maxVal = mv;
      }
      var ranges = pickCountRanges(maxVal);
      for (var r = 0; r < ranges.length; r++) {
        tabGroups[ranges[r].label] = [];
      }
      for (var j = 0; j < rows.length; j++) {
        var jp = rows[j].split(':');
        if (jp.length !== totalCols) continue;
        var jv = parseInt((jp[col] || '').trim(), 10);
        if (isNaN(jv)) continue;
        for (var ri = 0; ri < ranges.length; ri++) {
          if (jv >= ranges[ri].lo && jv <= ranges[ri].hi) {
            tabGroups[ranges[ri].label].push(rows[j]);
            break;
          }
        }
      }
      // Remove empty ranges
      for (var key in tabGroups) {
        if (!tabGroups[key].length) delete tabGroups[key];
      }
    }

    var keys = Object.keys(tabGroups);
    if (!keys.length) { tabsWrap.style.display = 'none'; return; }

    // Sort: years newest-first, count ranges by their numeric start
    if (colType === 'year') {
      keys.sort(function (a, b) { return +b - +a; });
    } else {
      keys.sort(function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10);
      });
    }

    var bar = $('#spTabsBar');
    var content = $('#spTabsContent');
    var prefix = colType === 'year' ? 'year' : 'range';

    // Tabs
    var bh = '';
    for (var t = 0; t < keys.length; t++) {
      var k = keys[t];
      var cnt = tabGroups[k].length;
      var active = t === 0 ? ' sp-tab-active' : '';
      bh += '<button class="sp-tab' + active + '" data-year="' + k + '">';
      bh += k + ' <span class="sp-tab-count">' + cnt + '</span>';
      bh += '</button>';
    }
    bar.innerHTML = bh;

    // Panes
    var ch = '';
    for (var p = 0; p < keys.length; p++) {
      var pk = keys[p];
      var lines = tabGroups[pk];
      var show = p === 0 ? 'block' : 'none';
      var fileLabel = pk.replace(/\s+/g, '').replace(/–/g, '-');
      ch += '<div class="sp-tab-pane" data-year="' + pk + '" style="display:' + show + '">';
      ch += '<div class="sp-tab-header">';
      ch += '<span class="sp-tab-info">' + pk + ' · ' + lines.length + ' accounts</span>';
      ch += '<div class="sp-tab-actions">';
      ch += '<button class="sp-tab-copy" data-year="' + pk + '">Copy</button>';
      ch += '<button class="sp-tab-save" data-year="' + pk + '" data-prefix="' + prefix + '_' + fileLabel + '">Save .txt</button>';
      ch += '</div></div>';
      ch += '<pre class="sp-tab-pre">' + escHtml(lines.join('\n')) + '</pre>';
      ch += '</div>';
    }
    content.innerHTML = ch;
    tabsWrap.style.display = 'block';
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ======== Mismatched / skipped lines ======== */

  // Collect the raw lines that will NOT be sorted because their colon-field
  // count differs from the detected total. These are the lines responsible for
  // an input/output count gap.
  function collectMismatches(rows, format) {
    var totalCols = format.totalColumns;
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]) continue;
      var n = rows[i].split(':').length;
      if (n !== totalCols) out.push({ line: rows[i], cols: n });
    }
    return out;
  }

  // Count rows dropped by active Year/Counts exclusions (the ✕ buttons). These
  // are correctly-shaped rows, so they're NOT column mismatches — but they do
  // widen the input/output gap, so the header must account for them too. Mirrors
  // the exclusion filter in sortLines exactly.
  // Is a numeric value inside any currently-excluded counts range?
  function valueInExcludedRange(sv) {
    var nv = parseInt((sv || '').trim(), 10);
    if (isNaN(nv)) return false;
    for (var rk in excludedRanges) {
      var er = excludedRanges[rk];
      if (nv >= er.lo && nv <= er.hi) return true;
    }
    return false;
  }

  // How many rows the current exclusions drop from the output. Mirrors the
  // pool-membership + exclusion predicate used in sortLines so the header count
  // stays accurate for both Year values and Counts ranges.
  function countExcluded(rows, format) {
    var colType = format.columnTypes[state.sorterColumn] || '';
    if (colType !== 'year' && colType !== 'counts') return 0;
    if (colType === 'year' && !Object.keys(excludedYears).length) return 0;
    if (colType === 'counts' && !Object.keys(excludedRanges).length) return 0;
    var totalCols = format.totalColumns;
    var col = state.sorterColumn;
    var columnTypes = format.columnTypes;
    var c = 0;
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i]) continue;
      var cols = rows[i].split(':');
      if (cols.length !== totalCols && !state.sorterForce) continue;
      var sv = sortValueFor(cols, col, columnTypes);
      if (colType === 'year') {
        if (excludedYears[(sv || '').trim()]) c++;
      } else if (valueInExcludedRange(sv)) {
        c++;
      }
    }
    return c;
  }

  function renderMismatch(mism, expected) {
    var wrap = $('#spMismatch');
    var box = $('#spMmBox');
    var sub = $('#spMmSub');
    var label = $('#spMmLabel');
    var forceBtn = $('#spMmForce');
    if (!wrap || !box) return;

    mismatchLines = mism.map(function (m) { return m.line; });
    var forced = !!state.sorterForce;

    // Keep the Force toggle in sync even when there are no mismatches.
    if (forceBtn) {
      forceBtn.classList.toggle('sp-mm-force-on', forced);
      forceBtn.textContent = forced ? 'Forced in ✓' : 'Force into sort';
    }

    if (!mism.length) {
      box.value = '';
      wrap.style.display = 'none';
      return;
    }

    // Box shows each irregular line prefixed with its actual column count so the
    // discrepancy is obvious; Copy/Save still emit the raw lines (mismatchLines).
    box.value = mism.map(function (m) {
      return '[' + m.cols + ' cols] ' + m.line;
    }).join('\n');

    // When forced in, recolor the panel and relabel — these lines are now part
    // of the sorted output, not dropped.
    wrap.classList.toggle('sp-mismatch-forced', forced);
    if (label) label.textContent = forced ? '↳ IRREGULAR LINES (in sort)' : '⚠️ SKIPPED LINES';

    if (sub) {
      // Distinct offending column counts, ascending.
      var seen = {}, distinct = [];
      for (var i = 0; i < mism.length; i++) {
        var c = mism[i].cols;
        if (!seen[c]) { seen[c] = true; distinct.push(c); }
      }
      distinct.sort(function (a, b) { return a - b; });
      var counts = 'expected ' + expected + ' columns, found ' + distinct.join(', ');
      sub.textContent = forced
        ? mism.length + ' irregular line' + (mism.length === 1 ? '' : 's') +
          ' (' + counts + ') — forced into the sort pool. Each is matched to the ' +
          'sort column by field type so it sorts correctly despite the missing/extra field.'
        : mism.length + ' line' + (mism.length === 1 ? '' : 's') +
          ' skipped — ' + counts + ' (fields split on “:”). Excluded from the sorted output.';
    }

    wrap.style.display = 'block';
  }

  /* ======== Sort logic ======== */

  // Does a field look like the given column type? Username is positional (it is
  // always the first field); every other type is matched via classifyCol.
  function fieldMatchesType(field, type, pos) {
    if (type === 'username') return pos === 0;
    if (!type) return false;
    var c = classifyCol(field);
    if (c === type) return true;
    if (type === 'mail_password' && c === 'password') return true; // classifies as plain password
    return false;
  }

  // Virtually align an irregular row against the detected column template,
  // dropping an empty placeholder wherever a typed field is missing — e.g. a
  // row with no phone gets an empty phone slot, so Counts/Year shift back to
  // their real column indices. This is the "dummy in the sorter's mind": the
  // placeholder exists only while sorting and is NEVER written to the output
  // line. Well-formed rows are returned untouched.
  function alignRow(cols, columnTypes) {
    var totalCols = columnTypes.length;
    if (cols.length === totalCols) return cols;
    var aligned = [];
    var ci = 0;
    var gaps = totalCols - cols.length; // >0 when the row is short on fields
    for (var p = 0; p < totalCols; p++) {
      var t = columnTypes[p];
      if (ci < cols.length && fieldMatchesType(cols[ci], t, p)) {
        aligned.push(cols[ci]); ci++;
      } else if (gaps > 0 && ci < cols.length) {
        // Field doesn't fit this typed slot → treat the slot as missing and
        // insert a virtual placeholder (spends one gap, keeps the field for the
        // next slot).
        aligned.push(''); gaps--;
      } else {
        aligned.push(ci < cols.length ? cols[ci] : ''); ci++;
      }
    }
    while (ci < cols.length) { aligned.push(cols[ci]); ci++; } // trailing extra fields
    return aligned;
  }

  // Value a row is sorted on. Well-formed rows read straight from the sort
  // index; forced-in irregular rows are realigned first (alignRow), with a
  // whole-row type scan as a safety net for typed columns.
  function sortValueFor(cols, sortBy, columnTypes) {
    var totalCols = columnTypes.length;
    var colType = columnTypes[sortBy] || '';
    if (cols.length === totalCols) return cols[sortBy] || '';
    var aligned = alignRow(cols, columnTypes);
    var v = aligned[sortBy];
    if (v && (!colType || fieldMatchesType(v, colType, sortBy))) return v;
    if (colType === 'username') return cols[0] || '';
    if (colType) {
      for (var i = 0; i < cols.length; i++) {
        if (classifyCol(cols[i]) === colType) return cols[i];
      }
    }
    return v || (cols[sortBy] || '');
  }

  function sortLines(lines, format) {
    var totalCols = format.totalColumns;
    var colTypes = format.columnTypes;
    var sortBy = state.sorterColumn;
    var order = state.sorterOrder;

    // Parse (filter out excluded years/values). Each entry carries the row's
    // columns plus its resolved sort value (sv), so type-recovery runs once per
    // row instead of on every comparison.
    var hasYearExcl = Object.keys(excludedYears).length > 0;
    var hasRangeExcl = Object.keys(excludedRanges).length > 0;
    var colType = colTypes[sortBy] || '';
    var parsed = [];
    for (var i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      var cols = lines[i].split(':');
      // Column-mismatched rows are dropped — unless the user has forced them in,
      // in which case they join the pool and are realigned by type below.
      if (cols.length !== totalCols && !state.sorterForce) continue;
      var sv = sortValueFor(cols, sortBy, colTypes);
      // Year: exclude by exact value. Counts: exclude any value inside a
      // removed range. Both are toggled from the breakdown ✕ buttons.
      if (colType === 'year' && hasYearExcl) {
        if (excludedYears[(sv || '').trim()]) continue;
      } else if (colType === 'counts' && hasRangeExcl && valueInExcludedRange(sv)) {
        continue;
      }
      parsed.push({ cols: cols, sv: sv });
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
      var isNumeric = (colType === 'counts' || colType === 'year');
      var reverse = (order === 'desc' || order === 'za');

      parsed.sort(function (a, b) {
        var av = a.sv || '';
        var bv = b.sv || '';
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

    return parsed.map(function (r) { return r.cols.join(':'); });
  }

  /* ======== Register mode ======== */
  App.App.registerMode({
    id: 'sorter',
    label: 'Sorter',
    run: function (text) {
      if (!panelBuilt) buildPanel();

      var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      lastRows = rows;
      if (!rows.length) {
        renderCols(null);
        var bd = $('#spBreakdown'); if (bd) bd.style.display = 'none';
        var rd = $('#spRangePanel'); if (rd) rd.style.display = 'none';
        var tw = $('#spTabsWrap'); if (tw) tw.style.display = 'none';
        var mm = $('#spMismatch'); if (mm) mm.style.display = 'none';
        mismatchLines = [];
        return '';
      }

      var format = detectFormat(rows);
      if (!format) {
        renderCols(null);
        var rd2 = $('#spRangePanel'); if (rd2) rd2.style.display = 'none';
        var mm2 = $('#spMismatch'); if (mm2) mm2.style.display = 'none';
        mismatchLines = [];
        return '';
      }

      // Clamp column index
      if (state.sorterColumn >= format.totalColumns) {
        state.sorterColumn = 0;
        saveSorterState();
      }

      lastFormat = format;
      lastSortCol = state.sorterColumn;

      renderCols(format);

      // Surface the two reasons the sorted output can be shorter than the input:
      //   • rows whose colon-field count != the detected total (structural), and
      //   • rows removed by active Year/Counts ✕ exclusions (deliberate).
      // Report both in the sub-header so the count fully explains the gap. Only
      // the structural mismatches go in the SKIPPED LINES box below.
      var mism = collectMismatches(rows, format);
      var excluded = countExcluded(rows, format);
      var sub = $('#spSub');
      if (sub) {
        var parts = ['Detected ' + format.totalColumns + ' columns'];
        if (mism.length) {
          parts.push(mism.length + ' line' + (mism.length === 1 ? '' : 's') +
            (state.sorterForce ? ' forced in' : ' skipped'));
        }
        if (excluded) parts.push(excluded + ' excluded');
        sub.textContent = parts.join(' · ');
      }
      renderMismatch(mism, format.totalColumns);

      renderBreakdown(rows, format);
      var sorted = sortLines(rows, format);
      return sorted.join('\n');
    }
  });
})();
