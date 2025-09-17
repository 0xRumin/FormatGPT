// plinks-with.js (FULL)
(function () {
  const { splitFlexible, sortLinesByCount, formatK } = App.Utils;
  const { pickUsernameForPlinks, pickFollowersFrom } = App.Renderers;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'plinksWith',
    label: 'Plinks with counts',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      let out = [];
      for (const row of rows) {
        const parts = splitFlexible(row);
        const user = pickUsernameForPlinks(parts);
        if (!user) return "Sorry, invalid format for plinks.\nExpected: user:pass:... (username required)";
        const rest = parts.filter(p => p !== user);
        const followersRaw = pickFollowersFrom(rest);
        const show = followersRaw !== "" && Number(followersRaw) >= 30;
        if (show) {
          const n = Number(followersRaw);
          const pretty = n >= 1000 ? formatK(n) : String(n);
          out.push(`x.com/${user} [${pretty}]`);
        } else {
          out.push(`x.com/${user}`);
        }
      }
      out = sortLinesByCount(out);
      return out.join("\n");
    }
  });
})();