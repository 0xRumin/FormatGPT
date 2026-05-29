// filter.js – Filter mode: match accounts against a username list
(function () {
  var U = App.Utils;
  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var panelBuilt = false;
  var lastMatched = [];
  var lastUnmatched = [];
  var lastMatchedTargets   = []; // target usernames that DID appear in an account
  var lastUnmatchedTargets = []; // target usernames that didn't appear in any account

  /* ======== State defaults ======== */
  // No persistence for the username list — always start empty.
  // Wipe any residual from earlier builds that did write to localStorage.
  try { localStorage.removeItem('filterUsernames'); } catch (e) {}
  state.filterUsernames = '';
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
    h += '<div class="fp-ta-btns">';
    h += '<button class="fp-clear-btn" id="fpClearBtn" type="button" title="Clear the username list">Clear</button>';
    h += '<button class="fp-paste-btn" id="fpPasteBtn" type="button">Paste</button>';
    h += '</div>';
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
    h += '<button class="fp-view' + (v === 'matchedTargets' ? ' fp-v-active' : '') + '" data-view="matchedTargets">Matched usernames</button>';
    h += '<button class="fp-view' + (v === 'unmatchedTargets' ? ' fp-v-active' : '') + '" data-view="unmatchedTargets">Unmatched usernames</button>';
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

    // Matched-target-usernames block — the target usernames typed into the
    // filter list that DID appear in at least one input account. Shows only
    // the username itself (original case), mirroring the Unmatched block.
    h += '<div class="fp-block" id="fpMatchedTargetsBlock">';
    h += '<div class="fp-block-header fp-bh-match">';
    h += '<span class="fp-block-title" id="fpMatchedTargetsTitle">\u2714 Matched Usernames (0)</span>';
    h += '<div class="fp-block-actions">';
    h += '<button class="fp-btn fp-btn-copy" id="fpCopyMatchedTargets">Copy</button>';
    h += '<button class="fp-btn fp-btn-save" id="fpSaveMatchedTargets">Save .txt</button>';
    h += '</div></div>';
    h += '<pre class="fp-output" id="fpMatchedTargetsOut">(no matched usernames)</pre>';
    h += '</div>';

    // Unmatched-target-usernames block — the target usernames typed into the
    // filter list that did NOT appear in any input account.
    h += '<div class="fp-block" id="fpUnmatchedTargetsBlock">';
    h += '<div class="fp-block-header fp-bh-unmatch">';
    h += '<span class="fp-block-title" id="fpUnmatchedTargetsTitle">\u2718 Unmatched Usernames (0)</span>';
    h += '<div class="fp-block-actions">';
    h += '<button class="fp-btn fp-btn-copy" id="fpCopyUnmatchedTargets">Copy</button>';
    h += '<button class="fp-btn fp-btn-save" id="fpSaveUnmatchedTargets">Save .txt</button>';
    h += '</div></div>';
    h += '<pre class="fp-output" id="fpUnmatchedTargetsOut">(no unmatched usernames)</pre>';
    h += '</div>';

    panel.innerHTML = h;

    // Intentionally NOT restoring any previous username list — always empty
    // on fresh page load so stale targets don't leak into new runs.

    bindEvents();
  }

  /* ======== Events ======== */
  function bindEvents() {
    // Username textarea — in-memory only, no localStorage persistence.
    $('#fpUsernames').addEventListener('input', function () {
      state.filterUsernames = this.value;
      App.App.rerun();
    });

    // Paste button
    $('#fpPasteBtn').addEventListener('click', function () {
      navigator.clipboard.readText().then(function (text) {
        var ta = $('#fpUsernames');
        if (ta) { ta.value = text; ta.dispatchEvent(new Event('input')); }
      }).catch(function () { alert('Paste failed. Long-press in the box and choose Paste.'); });
    });

    // Clear button — wipes the usernames list
    $('#fpClearBtn').addEventListener('click', function () {
      var ta = $('#fpUsernames');
      if (!ta) return;
      ta.value = '';
      state.filterUsernames = '';
      try { localStorage.removeItem('filterUsernames'); } catch (e) {}
      ta.dispatchEvent(new Event('input'));
      ta.focus();
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
    $('#fpCopyMatchedTargets').addEventListener('click', function () { copyText(lastMatchedTargets.join('\n'), this); });
    $('#fpCopyUnmatchedTargets').addEventListener('click', function () { copyText(lastUnmatchedTargets.join('\n'), this); });

    // Save
    $('#fpSaveMatched').addEventListener('click', function () { saveTxtFile(lastMatched.join('\n'), 'matched'); });
    $('#fpSaveUnmatched').addEventListener('click', function () { saveTxtFile(lastUnmatched.join('\n'), 'new_list'); });
    $('#fpSaveMatchedTargets').addEventListener('click', function () { saveTxtFile(lastMatchedTargets.join('\n'), 'matched_usernames'); });
    $('#fpSaveUnmatchedTargets').addEventListener('click', function () { saveTxtFile(lastUnmatchedTargets.join('\n'), 'unmatched_usernames'); });
  }

  /* ======== Helpers ======== */
  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = orig; }, 900);
    }).catch(function () { alert('Copy failed.'); });
  }

  function saveTxtFile(text /*, prefix (unused — filenames are now unique 6-char) */) {
    var filename = U.randFileName('txt');
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
    var mBlock  = $('#fpMatchedBlock');
    var uBlock  = $('#fpUnmatchedBlock');
    var mtBlock = $('#fpMatchedTargetsBlock');
    var utBlock = $('#fpUnmatchedTargetsBlock');
    if (mBlock)  mBlock.style.display  = (view === 'both' || view === 'matched')          ? 'block' : 'none';
    if (uBlock)  uBlock.style.display  = (view === 'both' || view === 'unmatched')        ? 'block' : 'none';
    // "Matched usernames" / "Unmatched usernames" only show when explicitly
    // selected — keeps the default Both view focused on accounts, not
    // target-list housekeeping.
    if (mtBlock) mtBlock.style.display = (view === 'matchedTargets')                      ? 'block' : 'none';
    if (utBlock) utBlock.style.display = (view === 'unmatchedTargets')                    ? 'block' : 'none';
  }

  /* ======== Core filter logic ======== */
  function runFilter(text) {
    // Build target map: lowercase-key -> original-case value (deduped).
    // We keep original case so "Unmatched usernames" shows names exactly as
    // the user typed them, not a lowercased version.
    var raw = (state.filterUsernames || '').trim();
    var targets = {};
    var numTargets = 0;
    if (raw) {
      raw.split(/\r?\n/).forEach(function (line) {
        var orig = line.trim();
        if (!orig) return;
        // If the pasted line contains colons, extract the first field (username)
        var username = orig.split(':')[0].trim();
        if (!username) return;
        var key = username.toLowerCase();
        if (!targets.hasOwnProperty(key)) { targets[key] = username; numTargets++; }
      });
    }

    // Process accounts
    var rows = text.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    lastMatched = [];
    lastUnmatched = [];
    var matchedTargetSet = {}; // which target usernames actually showed up

    for (var i = 0; i < rows.length; i++) {
      var parts = rows[i].split(':');
      var username = (parts[0] || '').trim().toLowerCase();
      if (username && targets.hasOwnProperty(username)) {
        lastMatched.push(rows[i]);
        matchedTargetSet[username] = true;
      } else {
        lastUnmatched.push(rows[i]);
      }
    }

    // Split the target list into matched / unmatched target usernames.
    // Preserve user's original case via targets[key].
    lastMatchedTargets   = [];
    lastUnmatchedTargets = [];
    for (var key in targets) {
      if (!targets.hasOwnProperty(key)) continue;
      if (matchedTargetSet[key]) lastMatchedTargets.push(targets[key]);
      else                       lastUnmatchedTargets.push(targets[key]);
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
          '<span class="fp-sum-ok">\u2714 Matched Usernames: <b>' + lastMatchedTargets.length + '</b></span>' +
          '<span class="fp-sum-no">\u2718 Unmatched Usernames: <b>' + lastUnmatchedTargets.length + '</b></span>' +
        '</div>';
    }

    // Update output blocks
    var mTitle  = $('#fpMatchedTitle');
    var uTitle  = $('#fpUnmatchedTitle');
    var mtTitle = $('#fpMatchedTargetsTitle');
    var utTitle = $('#fpUnmatchedTargetsTitle');
    var mOut    = $('#fpMatchedOut');
    var uOut    = $('#fpUnmatchedOut');
    var mtOut   = $('#fpMatchedTargetsOut');
    var utOut   = $('#fpUnmatchedTargetsOut');

    if (mTitle)  mTitle.textContent  = '\u2714 Matched (' + lastMatched.length + ')';
    if (uTitle)  uTitle.textContent  = '\u2718 New List (' + lastUnmatched.length + ')';
    if (mtTitle) mtTitle.textContent = '\u2714 Matched Usernames (' + lastMatchedTargets.length + ')';
    if (utTitle) utTitle.textContent = '\u2718 Unmatched Usernames (' + lastUnmatchedTargets.length + ')';
    if (mOut)    mOut.textContent    = lastMatched.length   ? lastMatched.join('\n')         : '(no matches)';
    if (uOut)    uOut.textContent    = lastUnmatched.length ? lastUnmatched.join('\n')       : '(no unmatched)';
    if (mtOut)   mtOut.textContent   = lastMatchedTargets.length   ? lastMatchedTargets.join('\n')   : '(no matched usernames)';
    if (utOut)   utOut.textContent   = lastUnmatchedTargets.length ? lastUnmatchedTargets.join('\n') : '(no unmatched usernames)';

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
