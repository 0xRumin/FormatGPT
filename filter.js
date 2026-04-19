// filter.js – Filter mode: match accounts against a username list
(function () {
  var U = App.Utils;
  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var panelBuilt = false;
  var lastMatched = [];
  var lastUnmatched = [];

  /* ======== State defaults ======== */
  if (state.filterUsernames == null) state.filterUsernames = '';
  if (!state.filterView) state.filterView = 'both';

  /* ======== Panel creation ======== */
  function ensurePanelEl() {
    var panel = $('#filterPanel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'filterPanel';
    panel.className = 'card';
    panel.style.display = 'block';
    // Insert before the output card
    var outCard = $('#out');
    if (outCard) {
      var card = outCard.closest('.card');
      if (card) { card.parentNode.insertBefore(panel, card); return panel; }
    }
    var main = document.querySelector('main');
    if (main) main.appendChild(panel);
    return panel;
  }

  function buildPanel() {
    var panel = ensurePanelEl();
    if (!panel || panelBuilt) return;
    panelBuilt = true;
    panel.style.display = 'block';

    var h = '';

    // Usernames input
    h += '<div class="fp-section">';
    h += '<div class="fp-label">USERNAMES TO FILTER</div>';
    h += '<div class="fp-ta-wrap">';
    h += '<textarea class="fp-usernames" id="fpUsernames" placeholder="Paste usernames here (one per line)" spellcheck="false"></textarea>';
    h += '<button class="fp-paste-btn" id="fpPasteBtn" type="button">Paste</button>';
    h += '</div></div>';

    // Summary
    h += '<div class="fp-summary" id="fpSummary"></div>';

    // View toggle
    h += '<div class="fp-section">';
    h += '<div class="fp-views" id="fpViews">';
    var v = state.filterView || 'both';
    h += '<button class="fp-view' + (v === 'both' ? ' fp-v-active' : '') + '" data-view="both">Both</button>';
    h += '<button class="fp-view' + (v === 'matched' ? ' fp-v-active' : '') + '" data-view="matched">Matched</button>';
    h += '<button class="fp-view' + (v === 'unmatched' ? ' fp-v-active' : '') + '" data-view="unmatched">Unmatched</button>';
    h += '</div></div>';

    // Matched output block
    h += '<div class="fp-block" id="fpMatchedBlock">';
    h += '<div class="fp-block-header fp-bh-match">';
    h += '<span class="fp-block-title" id="fpMatchedTitle">\u2714 Matched (0)</span>';
    h += '<div class="fp-block-actions">';
    h += '<button class="fp-btn fp-btn-copy" id="fpCopyMatched">Copy</button>';
    h += '<button class="fp-btn fp-btn-save" id="fpSaveMatched">Save .txt</button>';
    h += '</div></div>';
    h += '<pre class="fp-output" id="fpMatchedOut">(no matches)</pre>';
    h += '</div>';

    // Unmatched output block
    h += '<div class="fp-block" id="fpUnmatchedBlock">';
    h += '<div class="fp-block-header fp-bh-unmatch">';
    h += '<span class="fp-block-title" id="fpUnmatchedTitle">\u2718 New List (0)</span>';
    h += '<div class="fp-block-actions">';
    h += '<button class="fp-btn fp-btn-copy" id="fpCopyUnmatched">Copy</button>';
    h += '<button class="fp-btn fp-btn-save" id="fpSaveUnmatched">Save .txt</button>';
    h += '</div></div>';
    h += '<pre class="fp-output" id="fpUnmatchedOut">(no unmatched)</pre>';
    h += '</div>';

    panel.innerHTML = h;

    // Load saved usernames
    var ta = $('#fpUsernames');
    if (ta && state.filterUsernames) ta.value = state.filterUsernames;

    bindEvents();
  }

  /* ======== Events ======== */
  function bindEvents() {
    // Username textarea
    $('#fpUsernames').addEventListener('input', function () {
      state.filterUsernames = this.value;
      localStorage.setItem('filterUsernames', this.value);
      App.App.rerun();
    });

    // Paste button
    $('#fpPasteBtn').addEventListener('click', function () {
      navigator.clipboard.readText().then(function (text) {
        var ta = $('#fpUsernames');
        if (ta) { ta.value = text; ta.dispatchEvent(new Event('input')); }
      }).catch(function () { alert('Paste failed. Long-press in the box and choose Paste.'); });
    });

    // View toggle
    $('#fpViews').addEventListener('click', function (e) {
      var btn = e.target.closest('.fp-view');
      if (!btn) return;
      state.filterView = btn.dataset.view;
      localStorage.setItem('filterView', state.filterView);
      syncViewBtns();
      syncBlocks();
    });

    // Copy
    $('#fpCopyMatched').addEventListener('click', function () { copyText(lastMatched.join('\n'), this); });
    $('#fpCopyUnmatched').addEventListener('click', function () { copyText(lastUnmatched.join('\n'), this); });

    // Save
    $('#fpSaveMatched').addEventListener('click', function () { saveTxtFile(lastMatched.join('\n'), 'matched'); });
    $('#fpSaveUnmatched').addEventListener('click', function () { saveTxtFile(lastUnmatched.join('\n'), 'new_list'); });
  }

  /* ======== Helpers ======== */
  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = orig; }, 900);
    }).catch(function () { alert('Copy failed.'); });
  }

  function saveTxtFile(text, prefix) {
    var token = U.randToken(5);
    var filename = prefix + '_' + token + '.txt';
    var blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }

  function syncViewBtns() {
    var btns = document.querySelectorAll('#fpViews .fp-view');
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle('fp-v-active', btns[i].dataset.view === state.filterView);
  }

  function syncBlocks() {
    var view = state.filterView || 'both';
    var mBlock = $('#fpMatchedBlock');
    var uBlock = $('#fpUnmatchedBlock');
    if (mBlock) mBlock.style.display = (view === 'both' || view === 'matched') ? 'block' : 'none';
    if (uBlock) uBlock.style.display = (view === 'both' || view === 'unmatched') ? 'block' : 'none';
  }

  /* ======== Core filter logic ======== */
  function runFilter(text) {
    // Build target set (lowercase, deduped)
    var raw = (state.filterUsernames || '').trim();
    var targets = {};
    var numTargets = 0;
    if (raw) {
      raw.split(/\r?\n/).forEach(function (line) {
        var u = line.trim().toLowerCase();
        if (u && !targets[u]) { targets[u] = true; numTargets++; }
      });
    }

    // Process accounts
    var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    lastMatched = [];
    lastUnmatched = [];

    for (var i = 0; i < rows.length; i++) {
      var parts = rows[i].split(':');
      var username = (parts[0] || '').trim().toLowerCase();
      if (username && targets[username]) {
        lastMatched.push(rows[i]);
      } else {
        lastUnmatched.push(rows[i]);
      }
    }

    // Update summary
    var sum = $('#fpSummary');
    if (sum) {
      sum.innerHTML =
        '<div class="fp-sum-line">' +
          '<span>Total Accounts: <b>' + rows.length + '</b></span>' +
          '<span>Target Usernames: <b>' + numTargets + '</b></span>' +
        '</div>' +
        '<div class="fp-sum-line">' +
          '<span class="fp-sum-ok">\u2714 Matched: <b>' + lastMatched.length + '</b></span>' +
          '<span class="fp-sum-no">\u2718 New List: <b>' + lastUnmatched.length + '</b></span>' +
        '</div>';
    }

    // Update output blocks
    var mTitle = $('#fpMatchedTitle');
    var uTitle = $('#fpUnmatchedTitle');
    var mOut   = $('#fpMatchedOut');
    var uOut   = $('#fpUnmatchedOut');

    if (mTitle) mTitle.textContent = '\u2714 Matched (' + lastMatched.length + ')';
    if (uTitle) uTitle.textContent = '\u2718 New List (' + lastUnmatched.length + ')';
    if (mOut)   mOut.textContent = lastMatched.length ? lastMatched.join('\n') : '(no matches)';
    if (uOut)   uOut.textContent = lastUnmatched.length ? lastUnmatched.join('\n') : '(no unmatched)';

    syncBlocks();
  }

  /* ======== Register mode ======== */
  App.App.registerMode({
    id: 'filter',
    label: 'Filter',
    run: function (text) {
      if (!panelBuilt) buildPanel();
      runFilter(text);
      // Return empty — filter uses its own dual output blocks
      return '';
    }
  });
})();
