// js/app.js
(function () {
  window.App = window.App || {};

  // ========= Mini Helpers (self-contained) =========
  const $ = (sel, root = document) => root.querySelector(sel);

  const isHex40 = (s) => /^[a-f0-9]{40}$/i.test(s || "");
  const is2FAKey = (s) => /^[A-Z0-9]{16}$/.test((s || "").toUpperCase());
  const isEmail  = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
  const isYear   = (s) => /^(2007|2008|2009|201\d|202\d|2025)$/.test(s || "");
  const looksPhone = (s) => /^\d{10,15}$/.test((s || "").replace(/[^\d]/g, ""));
  const addPlus = (digits) => (digits.startsWith("+") ? digits : "+" + digits);

  const stripLeadingNumbersForStandard = (s) => (s || "").replace(/^\d+/, "");
  const extract2FAFromLink = (s) => {
    const m = String(s || "").match(/2fa\.fb\.rip\/([A-Z0-9]{16})/i);
    return m ? m[1].toUpperCase() : "";
  };

  function detectDelim(line) {
    if (line.includes("----")) return "----";
    if (line.includes(":"))   return ":";
    if (line.includes(";"))   return ";";
    if (line.includes(","))   return ",";
    return ":"; // default
  }
  function splitFlexible(line) {
    const d = detectDelim(line);
    return d === "----"
      ? line.split("----").map((s) => s.trim())
      : line.split(d).map((s) => s.trim());
  }

  // expose for UI
  App.Utils = App.Utils || {};
  App.Utils.$ = $;
  App.Utils.splitFlexible = splitFlexible;

  // ========= Emoji fallback detection =========
  function supportsEmoji(char) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      ctx.textBaseline = "top";
      ctx.font = "16px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      ctx.clearRect(0,0,16,16);
      ctx.fillText(char, 0, 0);
      const data = ctx.getImageData(0, 0, 16, 16).data;
      // any non-zero pixel implies something was drawn (good enough for fallback)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] !== 0) return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  const MAIL_BULLET = supportsEmoji("🔸") ? "🔸" : "◆";

  // ========= State (embedded) =========
  const State = (window.App.State =
    window.App.State ||
    (function () {
      function normalizeMailAccess(s) {
        const v = (s || "").trim();
        if (!v) return "https://firstmail.ltd/en-US/webmail";
        if (/^https?:\/\//i.test(v)) return v;
        if (/^\/\//.test(v)) return "https:" + v;
        return "https://" + v;
      }
      const state = {
        blue: false,
        addMail: false,
        mailAccess: normalizeMailAccess(localStorage.getItem("mailAccess") || ""),
        mode: "standard",
      };
      function setMailAccess(v) {
        state.mailAccess = normalizeMailAccess(v);
        localStorage.setItem("mailAccess", state.mailAccess);
      }
      function initState() {}
      function resetMailAccess() {
        setMailAccess("https://firstmail.ltd/en-US/webmail");
      }
      return { state, setMailAccess, resetMailAccess, initState, normalizeMailAccess };
    })());

  const { state, setMailAccess } = State;

  // ========= Download helper =========
  function randomName(len = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < len; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  }
  function saveTxt() {
    const contents = $("#out").textContent || "";
    const name = "s" + randomName(5) + ".txt";
    const blob = new Blob(["\uFEFF" + contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  // ========= STANDARD =========
  function renderStandard(parts, forceBlue) {
    let [user, pass, ...rest] = parts;
    user = stripLeadingNumbersForStandard(user || "");
    pass = pass || "";

    let mail = "", mailPass = "", token = "", raw2fa = "",
        followersRaw = "", year = "", phone = "";

    for (const p0 of rest) {
      const p = (p0 || "").trim();
      if (!p) continue;

      if (!mail && isEmail(p)) { mail = p; continue; }
      if (!token && isHex40(p)) { token = p; continue; }
      if (!raw2fa && is2FAKey(p)) { raw2fa = p.toUpperCase(); continue; }
      if (!raw2fa && /2fa\.fb\.rip\//i.test(p)) { raw2fa = extract2FAFromLink(p); continue; }

      const digits = p.replace(/[^\d]/g, "");
      if (!year && isYear(p)) { year = p; continue; }
      if (!phone && looksPhone(digits)) { phone = addPlus(digits); continue; }

      if (followersRaw === "" && /^\d+$/.test(p) && !isYear(p)) { followersRaw = p; continue; }

      if (
        !mailPass &&
        !isEmail(p) && !isHex40(p) && !is2FAKey(p) &&
        !/2fa\.fb\.rip\//i.test(p) && !isYear(p) && !/^\d+$/.test(p)
      ) {
        mailPass = p; continue;
      }
    }

    const lines = [];
    if (user) lines.push(`User: \`${user}\``);
    if (pass) lines.push(`Pass: \`${pass}\``);
    if (phone) lines.push(`Phone: ${phone}`);                  // << phone right after pass
    if (mail) lines.push(`Mail: \`${mail}\``);
    if (mail && mailPass) lines.push(`Mail Pass: \`${mailPass}\``);
    if (token) lines.push(`Auth Token: \`${token}\``);
    if (raw2fa) lines.push(`2FA: https://2fa.fb.rip/${raw2fa}`);
    if (year)   lines.push(`Joined: ${year}`);

    if (user) {
      let tail = "";
      if (followersRaw !== "" && Number(followersRaw) >= 30) tail = ` [${followersRaw}]`;
      else if (phone) tail = ` [${phone}]`;
      lines.push(`Plink: x.com/${user}${tail}`);
    }

    if (forceBlue) {
      lines.push("");
      lines.push("-------------");
      if (year) {
        lines.push(`Never set age less than 14 years from account creation time [${year}] otherwise it'll be locked.`);
      } else {
        lines.push(`Never set age less than 14 years from account creation time otherwise it'll be locked.`);
      }
      lines.push("");
      lines.push(`${MAIL_BULLET} Mail Access:`);               // << emoji-safe bullet
      lines.push(state.mailAccess);
    }
    return lines.join("\n");
  }

  // ========= XFLY =========
  function renderXfly(parts) {
    let [user, pass, ...rest] = parts;
    user = stripLeadingNumbersForStandard(user || "");
    let key = rest.find((x) => is2FAKey(x));
    if (!key) {
      const link = rest.find((x) => /2fa\.fb\.rip\//i.test(x || ""));
      if (link) key = extract2FAFromLink(link);
    }
    if (!user || !pass || !key)
      return "Sorry, invalid format for xfly.\nExpected: username:password:RAW2FAKEY (16 A–Z/0–9; 2FA link accepted).";
    return `${user}:${pass}:${key}`;
  }

  // ========= Reverse (label-tolerant) =========
  function getByAliases(lines, aliases) {
    const lower = lines.map((l) => l.toLowerCase());
    for (let i = 0; i < lines.length; i++) {
      let ln = lower[i].replace(/\s+/g, " ").replace(/_/g, " ");
      for (const raw of aliases) {
        const al = raw.toLowerCase().replace(/\s+/g, " ");
        if (ln.startsWith(al + ":")) {
          const v = lines[i].slice(lines[i].indexOf(":") + 1).trim();
          return v.replace(/^`|`$/g, "");
        }
      }
    }
    return "";
  }
  function parseFormattedBlockAnyLabels(lines) {
    const user = getByAliases(lines, ["user","account","username"]);
    const pass = getByAliases(lines, ["pass","password"]);
    const mail = getByAliases(lines, ["mail","email"]);
    const mailPass = getByAliases(lines, ["mail pass","email password","email_password"]);
    const token = getByAliases(lines, ["auth token","token"]);
    let   twofa = getByAliases(lines, ["2fa","twofa"]);
    const joined = getByAliases(lines, ["joined","year"]);
    const plink  = getByAliases(lines, ["plink"]);
    const m = twofa.match(/2fa\.fb\.rip\/([A-Z0-9]{16})/i); if(m) twofa = m[1];
    let followers = ""; const f = plink.match(/\[(\d+)\]\s*$/); if(f) followers = f[1];
    const phone = getByAliases(lines, ["phone"]);
    return { user, pass, mail, mailPass, token, twofa, followers, joined, phone };
  }
  const joinReverseSmart = (arr) => arr.filter(v => v!=null && String(v).trim()!=="").join(":");

  // ========= Plinks helpers =========
  function pickFollowersFrom(tokens) {
    for (const t of tokens) {
      const v = (t || "").trim();
      if (!/^\d+$/.test(v)) continue;
      if (isYear(v)) continue;
      if (Number(v) >= 30) return v;
    }
    return "";
  }

  // ========= Convert usernames =========
  function convertUsernames(lines) {
    function normUser(raw) {
      const u = (raw || "").trim();
      const m = u.match(/(?:https?:\/\/)?(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/i);
      return m ? m[1] : u.replace(/^@/, "");
    }
    function parseLine(line) {
      const d = detectDelim(line);
      if (d === "----") return { user: normUser(line), count: null };
      const parts = line.split(d).map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) return { user: normUser(parts[0]), count: null };
      let user = normUser(parts[0]); let count = parts[1];
      if (/^\d+(\.\d+)?(k|m)?$/i.test(parts[0]) && parts[1]) { user = normUser(parts[1]); count = parts[0]; }
      count = (count || "").toLowerCase().replace(/,/g, "");
      if (/^\d+(\.\d+)?[km]$/.test(count)) {
        const mult = count.endsWith("m") ? 1_000_000 : 1_000;
        count = String(parseFloat(count) * mult);
      }
      return { user, count: count && /^\d+(\.\d+)?$/.test(count) ? Number(count) : null };
    }
    const rows = lines.map(parseLine).filter(r => r.user);
    rows.sort((a,b)=>{
      if (a.count==null && b.count==null) return a.user.localeCompare(b.user);
      if (a.count==null) return 1;
      if (b.count==null) return -1;
      return b.count-a.count;
    });
    const human = (n)=> n==null ? "" : (n>=1000 ? ` [${(n/1000).toFixed(2)}k]` : ` [${n}]`);
    return rows.map(r=>`x.com/${r.user}${r.count!=null?human(r.count):""}`).join("\n");
  }

  // ========= Rerun (core) =========
  function rerun() {
    const txt = $("#inp").value || "";
    const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    const out = [];
    if (!lines.length) { $("#out").textContent = ""; return; }

    const mode = state.mode;

    // Convert usernames
    if (mode === "convertUsers") {
      const converted = convertUsernames(lines);
      $("#out").textContent = state.addMail && converted.trim()
        ? converted + `\n\n-------------\n${MAIL_BULLET} Mail Access:\n` + state.mailAccess
        : converted;
      return;
    }

    // Plinks
    if (mode === "plinksWith" || mode === "plinksWithout") {
      const withCounts = (mode === "plinksWith");
      for (const row of lines) {
        const parts = splitFlexible(row);
        let user = (parts[0] || "").replace(/^@/, ""); // keep leading 0s
        const rest = parts.slice(1);
        if (!user) { $("#out").textContent = "Sorry, invalid format for plinks."; return; }
        const followersRaw = withCounts ? pickFollowersFrom(rest) : "";
        const show = withCounts && followersRaw !== "" && Number(followersRaw) >= 30;
        out.push(`x.com/${user}${show?` [${followersRaw}]`:""}`);
      }
      if (state.addMail && out.length) {
        out.push(""); out.push("-------------"); out.push(`${MAIL_BULLET} Mail Access:`); out.push(state.mailAccess);
      }
      $("#out").textContent = out.join("\n"); return;
    }

    // Xfly
    if (mode === "xfly") {
      for (const row of lines) out.push(renderXfly(splitFlexible(row)));
      if (state.addMail && out.length) {
        out.push(""); out.push("-------------"); out.push(`${MAIL_BULLET} Mail Access:`); out.push(state.mailAccess);
      }
      $("#out").textContent = out.join("\n"); return;
    }

    // Reverse
    if (mode === "reverse") {
      const chunks = txt.replace(/\r/g,"").split(/\n\s*(?:-{6,}\s*)?\n+/).map(ch=>ch.trim()).filter(Boolean);
      for (const chunk of chunks) {
        const rws = chunk.split(/\n/).map(r=>r.trim()).filter(Boolean);
        const looksBlock = rws.some(r => /^[a-z_ ]+:/i.test(r));
        if (looksBlock) {
          const { user, pass, mail, mailPass, token, twofa, followers, joined, phone } =
            parseFormattedBlockAnyLabels(rws);
          if (!user && !pass) { out.push("Sorry, invalid format for reverse."); continue; }
          out.push(joinReverseSmart([user, pass, mail, mailPass, token, twofa, followers || phone || "", joined]));
          continue;
        }
        for (const line of rws) {
          const parts = splitFlexible(line);
          for (let i=0;i<parts.length;i++){
            if (/2fa\.fb\.rip\//i.test(parts[i])) parts[i] = extract2FAFromLink(parts[i]);
          }
          out.push(joinReverseSmart(parts.slice(0,8)));
        }
      }
      if (state.addMail && out.length) {
        out.push(""); out.push("-------------"); out.push(`${MAIL_BULLET} Mail Access:`); out.push(state.mailAccess);
      }
      $("#out").textContent = out.join("\n"); return;
    }

    // Standard (default) — also auto-sort by follower counts if present in each row
    const rowsWithMeta = lines.map((row, idx) => {
      const parts = splitFlexible(row);
      // sniff numeric candidate (followers) in the tail (ignore years)
      const maybe = parts.slice(2).map(v=>v.trim()).filter(Boolean).find(v=>/^\d+$/.test(v) && !isYear(v));
      return { row, parts, count: maybe ? Number(maybe) : null, idx };
    });
    // stable sort: by count desc when both have counts, else preserve input order
    rowsWithMeta.sort((a,b)=>{
      if (a.count==null && b.count==null) return a.idx - b.idx;
      if (a.count==null) return 1;
      if (b.count==null) return -1;
      return b.count - a.count;
    });

    for (const item of rowsWithMeta) {
      out.push(renderStandard(item.parts, state.blue));
      out.push("");
    }
    if (state.addMail && out.join("").trim()) {
      out.push("-------------"); out.push(`${MAIL_BULLET} Mail Access:`); out.push(state.mailAccess);
    }
    $("#out").textContent = out.join("\n").trim();
  }

  function setMode(val) { state.mode = val || "standard"; }

  // expose for UI
  App.App = { setMode, rerun, saveTxt, setMailAccess, MAIL_BULLET };
})();