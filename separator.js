// separator.js — "Separator" mode
//
// Ports main.py: split a mixed account list into PHONE vs MAIL groups.
//   • A line containing '@' anywhere is a MAIL account.
//   • Otherwise, if any ':'-separated field is a phone number (optional leading
//     '+', 7–15 digits) the line is a PHONE account, and every bare phone field
//     (digits only, no '+') gets a leading '+'.
//   • Anything else falls through to MAIL.
//
// The output pane shows two tabs — Phone / Mail — and #out holds only the
// selected group. Tab counts update live; the tabs are CSS-gated to this mode.
(function () {
  var PHONE_ANY  = /^\+?\d{7,15}$/; // detects a phone field (with or without +)
  var PHONE_BARE = /^\d{7,15}$/;    // a phone field missing its leading +

  var activeTab = 'phone'; // 'phone' | 'mail' — which group #out is showing
  var tabsWired = false;

  function byId(id) { return document.getElementById(id); }

  // Classify one raw line → { group: 'phone'|'mail', line } or null if blank.
  function classify(line) {
    var clean = (line || '').trim();
    if (!clean) return null;

    // Any '@' → treat the whole line as a mail account (matches main.py).
    if (clean.indexOf('@') >= 0) return { group: 'mail', line: clean };

    var parts = clean.split(':');
    var isPhone = parts.some(function (p) { return PHONE_ANY.test(p); });
    if (isPhone) {
      var normalized = parts.map(function (p) {
        return PHONE_BARE.test(p) ? '+' + p : p;
      }).join(':');
      return { group: 'phone', line: normalized };
    }
    return { group: 'mail', line: clean };
  }

  function setActiveTab(tab) {
    activeTab = (tab === 'mail') ? 'mail' : 'phone';
    var tabs = document.querySelectorAll('#separatorTabs .sep-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === activeTab;
      tabs[i].classList.toggle('sep-tab-on', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function updateCounts(phoneN, mailN) {
    var p = byId('sepPhoneCount'), m = byId('sepMailCount');
    if (p) p.textContent = phoneN;
    if (m) m.textContent = mailN;
  }

  // Bind the tab bar once. Clicking a tab swaps which group #out shows.
  function wireTabs() {
    if (tabsWired) return;
    var bar = byId('separatorTabs');
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
    id: 'separator',
    label: 'Separator',
    run: function (text) {
      wireTabs();

      var rows = String(text || '').split(/\r?\n/);
      var phones = [], mails = [];
      for (var i = 0; i < rows.length; i++) {
        var r = classify(rows[i]);
        if (!r) continue;
        (r.group === 'phone' ? phones : mails).push(r.line);
      }

      updateCounts(phones.length, mails.length);
      setActiveTab(activeTab); // keep the tab highlight in sync

      // #out shows ONLY the selected group (one account per line).
      var group = activeTab === 'mail' ? mails : phones;
      return group.join('\n');
    }
  });
})();
