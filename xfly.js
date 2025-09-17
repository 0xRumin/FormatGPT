// xfly.js (FULL)
(function () {
  const { is2FAKey } = App.Utils;
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
        let [user, pass, ...rest] = parts;
        let key = rest.find(x => is2FAKey(x));
        if (!key) {
          const link = rest.find(x => /2fa\.fb\.rip\//i.test(x || ""));
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