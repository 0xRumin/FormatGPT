// duplicate.js — "Duplicate Finder" mode
//
// Ports main.py (dedupe-by-username). The identity of each line is the text
// BEFORE the first ':' (trimmed). The FIRST line seen for a username is kept as
// UNIQUE; every later line with that same username is a DUPLICATE (a removed
// extra). Blank lines — and lines whose username is empty — are skipped, exactly
// like the script. Original order is preserved.
//
//   Unique      = first occurrence of each username   (main.py: unique_accounts)
//   Duplicates  = the extra 2nd+ occurrences          (main.py summary "Duplicates")
//   Unique.length + Duplicates.length == total scanned lines
//
// The output pane shows two tabs — Unique / Duplicates — and #out holds only the
// selected group. Tab counts update live. The tabs reuse the .sep-tab styling
// (so they pick up the neon theme + active-tab highlight) and are CSS-gated to
// this mode via body[data-mode="duplicate"].
(function () {
  var activeTab = 'unique'; // 'unique' | 'duplicates' — which group #out shows
  var tabsWired = false;

  function byId(id) { return document.getElementById(id); }

  function setActiveTab(tab) {
    activeTab = (tab === 'duplicates') ? 'duplicates' : 'unique';
    var tabs = document.querySelectorAll('#dupTabs .sep-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === activeTab;
      tabs[i].classList.toggle('sep-tab-on', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function updateCounts(uniqueN, dupN) {
    var u = byId('dupUniqueCount'), d = byId('dupDupCount');
    if (u) u.textContent = uniqueN;
    if (d) d.textContent = dupN;
  }

  // Bind the tab bar once. Clicking a tab swaps which group #out shows.
  function wireTabs() {
    if (tabsWired) return;
    var bar = byId('dupTabs');
    if (!bar) return;
    tabsWired = true;
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.sep-tab');
      if (!btn) return;
      setActiveTab(btn.getAttribute('data-tab'));
      App.App.rerun(); // re-run this mode → #out gets the selected group
    });
  }

  App.App = App.App || {};
  App.App.registerMode({
    id: 'duplicate',
    label: 'Duplicate Finder',
    run: function (text) {
      wireTabs();

      var rows = String(text || '').split(/\r?\n/);
      var seen = Object.create(null); // username -> true once its first line is kept
      var unique = [], duplicates = [];

      for (var i = 0; i < rows.length; i++) {
        var line = rows[i].trim();
        if (!line) continue;                     // skip blank lines
        var username = line.split(':')[0].trim();
        if (!username) continue;                 // main.py skips empty usernames
        if (seen[username]) {
          duplicates.push(line);                 // a removed extra
        } else {
          seen[username] = true;
          unique.push(line);                     // first occurrence → kept
        }
      }

      updateCounts(unique.length, duplicates.length);
      setActiveTab(activeTab); // keep the tab highlight in sync

      // #out shows ONLY the selected group (one account per line).
      var group = activeTab === 'duplicates' ? duplicates : unique;
      return group.join('\n');
    }
  });
})();
