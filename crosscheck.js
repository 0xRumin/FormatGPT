// crosscheck.js — Compare two lists, tabbed results (Unmatched / Matched), each copyable.
// List 1 comes from the main input textarea (#inp).
// List 2 comes from the output-pane textarea (#ccList2), which is revealed while crosscheck mode is active.
(function () {
  if (!window.App || !App.App || typeof App.App.registerMode !== 'function') return;

  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  state.crosscheck = state.crosscheck || { view: 'unmatched' };
  try {
    var savedView = localStorage.getItem('cc_view');
    if (savedView === 'matched' || savedView === 'unmatched') state.crosscheck.view = savedView;
    // List 2 is intentionally NOT persisted across sessions — wipe any residual value from
    // older builds so the textarea starts empty on reload.
    localStorage.removeItem('cc_list2');
  } catch (e) {}

  function saveView() { try { localStorage.setItem('cc_view', state.crosscheck.view); } catch (e) {} }

  var panelBuilt = false;

  function buildPanel() {
    var panel = $('#crosscheckPanel');
    if (!panel || panelBuilt) return;
    panelBuilt = true;

    panel.innerHTML = [
      '<div class="cc-head">',
        '<div class="cc-title">Cross<em>check</em></div>',
        '<div class="cc-sub">List 1 = Input pane · List 2 = Output pane · Results tabbed below</div>',
      '</div>',
      '<div class="cc-tabs" role="tablist">',
        '<button class="cc-tab" data-view="unmatched" type="button" role="tab">',
          'Unmatched · in L1 not L2',
          '<span class="cc-count" id="ccCountU">0</span>',
        '</button>',
        '<button class="cc-tab" data-view="matched" type="button" role="tab">',
          'Matched · in both',
          '<span class="cc-count" id="ccCountM">0</span>',
        '</button>',
      '</div>',
      '<div class="cc-result" id="ccResultU">',
        '<div class="cc-result__head">',
          '<span class="cc-result__title">Unmatched from List 1</span>',
          '<button class="cc-copy" type="button" data-src="U">Copy</button>',
        '</div>',
        '<pre class="cc-result__body" id="ccBodyU"></pre>',
      '</div>',
      '<div class="cc-result" id="ccResultM" hidden>',
        '<div class="cc-result__head">',
          '<span class="cc-result__title">Matched · present in both lists</span>',
          '<button class="cc-copy" type="button" data-src="M">Copy</button>',
        '</div>',
        '<pre class="cc-result__body" id="ccBodyM"></pre>',
      '</div>',
      '<div class="cc-stats" id="ccStats"></div>'
    ].join('');

    // Tab switching — show exactly one result block at a time
    panel.querySelector('.cc-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.cc-tab');
      if (!b) return;
      state.crosscheck.view = b.dataset.view === 'matched' ? 'matched' : 'unmatched';
      saveView();
      applyTabVisibility();
    });

    // Per-tab Copy buttons (independent)
    panel.addEventListener('click', function (e) {
      var btn = e.target.closest('.cc-copy');
      if (!btn) return;
      var src  = btn.dataset.src === 'M' ? '#ccBodyM' : '#ccBodyU';
      var body = $(src);
      var text = (body && body.textContent) || '';
      navigator.clipboard.writeText(text).then(function () {
        btn.classList.add('is-copied');
        var orig = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(function () {
          btn.classList.remove('is-copied');
          btn.textContent = orig;
        }, 900);
      }).catch(function () { alert('Copy failed.'); });
    });
  }

  function applyTabVisibility() {
    var tabs = document.querySelectorAll('#crosscheckPanel .cc-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('cc-active', tabs[i].dataset.view === state.crosscheck.view);
    }
    var u = $('#ccResultU'), m = $('#ccResultM');
    if (u) u.hidden = state.crosscheck.view !== 'unmatched';
    if (m) m.hidden = state.crosscheck.view !== 'matched';
  }

  // Wire the output-pane textarea (#ccList2) so typing in it re-runs the compare.
  // Safe to call repeatedly — uses dataset flag. List 2 is session-only (not persisted).
  function wireList2Input() {
    var ta = $('#ccList2');
    if (!ta || ta.dataset.ccBound === '1') return;
    ta.dataset.ccBound = '1';
    var _ccTimer = 0;
    ta.addEventListener('input', function () {
      clearTimeout(_ccTimer);
      _ccTimer = setTimeout(function () { App.App.rerun(); }, 140);
    });
  }

  function extractKey(line) {
    var t = (line || '').trim();
    if (!t) return '';
    // Prefer an x.com / twitter.com username if present
    var m = t.match(/(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]+)/i);
    if (m) return m[1].toLowerCase();
    // Fallback: first colon-separated token (credential list: user:pass:...)
    var parts = t.split(':');
    var first = (parts[0] || '').replace(/^@/, '').trim();
    return first.toLowerCase();
  }

  App.App.registerMode({
    id: 'crosscheck',
    label: 'Crosscheck',
    run: function (text) {
      if (!panelBuilt) buildPanel();
      wireList2Input();
      applyTabVisibility();

      var list1 = (text || '').split(/\r?\n/).filter(function (s) { return s.trim(); });
      var list2Raw = ($('#ccList2') && $('#ccList2').value) || '';
      var list2 = list2Raw.split(/\r?\n/).filter(function (s) { return s.trim(); });

      var set2 = new Set();
      for (var i = 0; i < list2.length; i++) {
        var k = extractKey(list2[i]);
        if (k) set2.add(k);
      }

      var matched = [];
      var unmatched = [];
      var l1keys = new Set();
      var duplicates = 0;
      for (var j = 0; j < list1.length; j++) {
        var k1 = extractKey(list1[j]);
        if (!k1) continue;
        if (l1keys.has(k1)) duplicates++;
        l1keys.add(k1);
        if (set2.has(k1)) matched.push(list1[j]);
        else unmatched.push(list1[j]);
      }

      var bodyU = $('#ccBodyU');
      var bodyM = $('#ccBodyM');
      if (bodyU) bodyU.textContent = unmatched.join('\n');
      if (bodyM) bodyM.textContent = matched.join('\n');

      var cU = $('#ccCountU'); if (cU) cU.textContent = String(unmatched.length);
      var cM = $('#ccCountM'); if (cM) cM.textContent = String(matched.length);

      var stats = $('#ccStats');
      if (stats) {
        stats.innerHTML =
          '<span class="cc-stat">L1 lines<b>' + list1.length + '</b></span>' +
          '<span class="cc-stat">L2 lines<b>' + list2.length + '</b></span>' +
          '<span class="cc-stat">L1 unique<b>' + l1keys.size + '</b></span>' +
          '<span class="cc-stat cc-m">Matched<b>' + matched.length + '</b></span>' +
          '<span class="cc-stat cc-u">Unmatched<b>' + unmatched.length + '</b></span>' +
          '<span class="cc-stat">L1 dupes<b>' + duplicates + '</b></span>';
      }

      // Output pane is already swapped to the List 2 textarea via CSS (body[data-mode="crosscheck"]),
      // so we don't need to populate #out. Return empty to keep main.js happy.
      return '';
    }
  });
})();
