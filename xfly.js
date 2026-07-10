// xfly.js (FULL)
(function () {
  const { is2FAKey, credentialParts } = App.Utils;
  const { extract2FAFromLink } = App.Renderers;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'xfly',
    label: 'Xfly',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const out = [];
      for (const row of rows) {
        const parts = row.split(/[:;,]/).map(s => s.trim()).filter(Boolean);
        const credentials = credentialParts(parts);
        const user = credentials.username;
        const pass = credentials.password;
        const rest = credentials.rest;
        let key = rest.find(x => is2FAKey(x));
        if (!key) {
          // accept old and new 2FA link formats
          const link = rest.find(x => /(?:2fa\.fb\.rip\/|browserscan\.net\/2fa#)/i.test(x || ""));
          if (link) key = extract2FAFromLink(link);
        }
        if (!user || !pass || !key) {
          out.push("Sorry, invalid format for xfly.\nExpected: username:password:RAW2FAKEY (16 A–Z/0–9; 2FA link accepted).");
        } else {
          out.push(`${user}:${pass}:${key}`);
        }
      }
      return out.join("\n");
    }
  });
})();
