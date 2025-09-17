// convert.js (FULL)
(function () {
  const U = App.Utils;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'convertUsers',
    label: 'Usernames → Plinks',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const parsed = [];

      function parseFlexibleCountToken(tok) {
        if (!tok) return null;
        const t = String(tok).replace(/^[\[\(\s]+|[\]\)\s]+$/g, "").replace(/,/g, "");
        const m = t.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
        if (!m) return null;
        const n = parseFloat(m[1]);
        return m[2] ? (/[mM]/.test(m[2]) ? n * 1_000_000 : n * 1_000) : n;
      }

      for (const row of rows) {
        const parts = U.splitFlexible(row);
        let uname = "";
        for (const token of parts) { if (!uname) { const u = U.extractUsernameAny(token); if (u) uname = u; } }
        if (!uname) { parsed.push({ user: "", count: null }); continue; }

        let count = null;
        for (const token of parts) {
          const bits = String(token).split(/[:;,]/).map(s => s.trim()).filter(Boolean);
          for (const b of bits) {
            const n = parseFlexibleCountToken(b);
            if (n != null) { count = n; break; }
          }
          if (count != null) break;
        }
        parsed.push({ user: uname, count });
      }

      const rows2 = parsed.filter(r => r.user);
      rows2.sort((a, b) => {
        if (a.count == null && b.count == null) return a.user.localeCompare(b.user);
        if (a.count == null) return 1;
        if (b.count == null) return -1;
        return b.count - a.count;
      });

      const out = rows2.map(r => {
        if (r.count == null) return `x.com/${r.user}`;
        const pretty = r.count >= 1000 ? U.formatK(r.count) : String(r.count);
        return `x.com/${r.user} [${pretty}]`;
      });

      return U.sortLinesByCount(out).join("\n");  // <-- FIX: return string
    }
  });
})();