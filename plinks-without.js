// plinks-without.js (FULL)
(function () {
  const { splitFlexible } = App.Utils;
  const { pickUsernameForPlinks } = App.Renderers;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'plinksWithout',
    label: 'Plinks w/o counts',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const out = [];
      for (const row of rows) {
        const parts = splitFlexible(row);
        const user = pickUsernameForPlinks(parts);
        if (!user) return "Sorry, invalid format for plinks.\nExpected: user:pass:... (username required)";
        out.push(`x.com/${user}`);
      }
      return out.join("\n");
    }
  });
})();