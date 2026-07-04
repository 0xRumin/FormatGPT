// reverse.js (FULL)
(function () {
  const { splitFlexible } = App.Utils;
  const { extract2FAFromLink } = App.Renderers;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'reverse',
    label: 'Reverse',
    run(text) {
      const chunks = text.replace(/\r/g, "").split(/\n\s*(?:-{6,}\s*)?\n+/).map(ch => ch.trim()).filter(Boolean);
      const out = [];
      for (const chunk of chunks) {
        const rws = chunk.split(/\n/).map(r => r.trim()).filter(Boolean);
        const looksBlock = rws.some(r => /^[a-z_ ]+:/i.test(r));
        if (!looksBlock) {
          for (const line of rws) {
            const parts = splitFlexible(line);
            for (let i = 0; i < parts.length; i++) {
              if (/(?:2fa\.fb\.rip\/|browserscan\.net\/2fa#)/i.test(parts[i])) parts[i] = extract2FAFromLink(parts[i]);
            }
            out.push(parts.slice(0, 8).filter(s => s != null && String(s).trim() !== "").join(":"));
          }
          continue;
        }

        const get = (label) => {
          const row = rws.find(l => l.toLowerCase().startsWith(label));
          if (!row) return "";
          const val = row.slice(label.length).trim();
          return val.replace(/^`|`$/g, "");
        };

        const user   = get("user:");
        const pass   = get("pass:");
        const phone  = get("phone:");
        const mail   = get("mail:");
        const mailPw = get("mail pass:");
        const refTok = get("refresh token:");
        const cliId  = get("client id:");
        const token  = get("auth token:");
        let twofa    = get("2fa:");
        const joined = get("joined:");
        // Accept both legacy 2fa.fb.rip/<KEY> and new browserscan.net/2fa#<KEY>
        const m = twofa.match(/(?:2fa\.fb\.rip\/|(?:www\.)?browserscan\.net\/2fa#)([A-Z0-9]{16})/i);
        if (m) twofa = m[1];

        // parse count from Plink: x.com/Name [6.30k]
        const plink = get("plink:");
        let countTok = "";
        if (plink) {
          const mc = plink.match(/\[(\d+(?:\.\d+)?)([kKmM])?\]/);
          if (mc) {
            const base = parseFloat(mc[1]);
            const mult = !mc[2] ? 1 : /m/i.test(mc[2]) ? 1_000_000 : 1_000;
            countTok = String(Math.round(base * mult));
          }
        }

        // If refresh token / client ID are present, emit the pipe-chunk
        // format: mail|mailpass|refresh_token|clientID. Otherwise keep the
        // legacy layout with mail and mailPw as separate colon-delimited fields.
        if (refTok || cliId) {
          const chunk = [mail, mailPw, refTok, cliId].join("|");
          out.push([user, pass, phone, chunk, token, twofa, countTok, joined].filter(s => s && String(s).trim() !== "").join(":"));
        } else {
          out.push([user, pass, phone, mail, mailPw, token, twofa, countTok, joined].filter(s => s && String(s).trim() !== "").join(":"));
        }
      }
      return out.join("\n");
    }
  });
})();