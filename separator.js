// separator.js — "Separator" mode
//
// Ports main.py: split a mixed account list into PHONE vs MAIL groups.
//   • A line containing '@' anywhere is a MAIL account.
//   • Otherwise, if any ':'-separated field is a phone number (optional leading
//     '+', 7–15 digits) the line is a PHONE account, and every bare phone field
//     (digits only, no '+') gets a leading '+'.
//   • Anything else falls through to MAIL.
// Output shows both groups, each with a count, phones first.
(function () {
  var PHONE_ANY  = /^\+?\d{7,15}$/; // detects a phone field (with or without +)
  var PHONE_BARE = /^\d{7,15}$/;    // a phone field missing its leading +

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

  App.App = App.App || {};
  App.App.registerMode({
    id: 'separator',
    label: 'Separator',
    run: function (text) {
      var rows = String(text || '').split(/\r?\n/);
      var phones = [], mails = [];
      for (var i = 0; i < rows.length; i++) {
        var r = classify(rows[i]);
        if (!r) continue;
        (r.group === 'phone' ? phones : mails).push(r.line);
      }

      if (!phones.length && !mails.length) return '';

      // Two blocks separated by a blank line, so the output pane's per-block
      // Copy button grabs a whole group at once. Phones first, then mail.
      var out = [];
      out.push('📱 PHONE ACCOUNTS (' + phones.length + ')');
      for (var p = 0; p < phones.length; p++) out.push(phones[p]);
      out.push('');
      out.push('📧 MAIL ACCOUNTS (' + mails.length + ')');
      for (var m = 0; m < mails.length; m++) out.push(mails[m]);
      return out.join('\n');
    }
  });
})();
