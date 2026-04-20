// crosscheck.js — Compare two lists; show unmatched (L1 not in L2) or matched (in both).
// Ported logic from D:\SCRIPTS\1. Mosts\Crosscheck\main.py
(function () {
  if (!window.App || !App.App || typeof App.App.registerMode !== 'function') return;

  var state = App.State.state;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  // Persisted sub-state
  state.crosscheck = state.crosscheck || { list2: '', view: 'unmatched' };
  try {
    var savedList2 = localStorage.getItem('cc_list2');
    var savedView  = localStorage.getItem('cc_view');
    if (savedList2 != null) state.crosscheck.list2 = savedList2;
    if (savedView === 'matched' || savedView === 'unmatched') state.crosscheck.view = savedView;
  } catch (e) {}

  function save() {
    try {
      localStorage.setItem('cc_list2', state.crosscheck.list2 || '');
      localStorage.setItem('cc_view',  state.crosscheck.view  || 'unmatched');
    } catch (e) {}
  }

  var panelBuilt = false;

  function buildPanel() {
    var panel = $('#crosscheckPanel');
    if (!panel || panelBuilt) return;
    panelBuilt = true;

    panel.innerHTML = [
      '<div class="cc-head">',
        '<div class="cc-title">Cross<em>check</em></div>',
        '<div class="cc-sub">Paste List 1 in the input · List 2 below · see what differs</div>',
      '</div>',
      '<div class="cc-modes" role="tablist">',
        '<button class="cc-btn" data-view="unmatched" type="button">Unmatched · in L1 not L2</button>',
        '<button class="cc-btn" data-view="matched"   type="button">Matched · in both</button>',
      '</div>',
      '<label class="cc-label" for="ccList2">List 2</label>',
      '<textarea id="ccList2" class="cc-textarea" spellcheck="false" placeholder="Paste list 2 here — one credential per line (e.g. user:pass:... or x.com/user)"></textarea>',
      '<div class="cc-stats" id="ccStats"></div>'
    ].join('');

    var ta = $('#ccList2');
    if (ta) {
      ta.value = state.crosscheck.list2 || '';
      ta.addEventListener('input', function () {
        state.crosscheck.list2 = ta.value;
        save();
        App.App.rerun();
      });
    }

    var modes = panel.querySelector('.cc-modes');
    if (modes) {
      modes.addEventListener('click', function (e) {
        var b = e.target.closest('.cc-btn');
        if (!b) return;
        state.crosscheck.view = b.dataset.view === 'matched' ? 'matched' : 'unmatched';
        save();
        syncModeBtns();
        App.App.rerun();
      });
    }
    syncModeBtns();
  }

  function syncModeBtns() {
    var btns = document.querySelectorAll('#crosscheckPanel .cc-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('cc-active', btns[i].dataset.view === state.crosscheck.view);
    }
  }

  function extractKey(line) {
    var t = (line || '').trim();
    if (!t) return '';
    // Prefer a twitter/x plink username if present
    var m = t.match(/(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]+)/i);
    if (m) return m[1].toLowerCase();
    // Fallback: first token before ':' (credential-list style)
    var parts = t.split(':');
    var first = (parts[0] || '').replace(/^@/, '').trim();
    return first.toLowerCase();
  }

  App.App.registerMode({
    id: 'crosscheck',
    label: 'Crosscheck',
    run: function (text) {
      if (!panelBuilt) buildPanel();

      var list1 = (text || '').split(/\r?\n/).filter(function (s) { return s.trim(); });
      var list2 = (state.crosscheck.list2 || '').split(/\r?\n/).filter(function (s) { return s.trim(); });

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

      return (state.crosscheck.view === 'matched' ? matched : unmatched).join('\n');
    }
  });
})();
