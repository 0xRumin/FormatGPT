// renderers.js (FULL)
(function () {
  window.App = window.App || {};
  const U = App.Utils;
  const { state } = App.State;

  const stripLeadingNumbersForStandard = (s) => (s || "").replace(/^\d+/, "");
  const extract2FAFromLink = (s) => {
    const m = String(s || "").match(/2fa\.fb\.rip\/([A-Z0-9]{16})/i);
    return m ? m[1].toUpperCase() : "";
  };

  function pickFollowersFrom(tokens) {
    for (const t of tokens) {
      const v = (t || "").trim();
      if (!/^\d+$/.test(v)) continue;
      if (U.isYear(v)) continue;
      if (Number(v) >= 30) return v;
    }
    return "";
  }

  function pickUsernameForPlinks(parts) {
    let user = (parts[0] || "").replace(/^@/, "");
    const m = user.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]+)/i);
    if (m) user = m[1];
    return user;
  }

  function renderStandardBlock(parts, forceBlue) {
    let [user, pass, ...rest] = parts;
    user = stripLeadingNumbersForStandard(user || "");
    pass = pass || "";

    let mail = "", mailPass = "", token = "", raw2fa = "", followersRaw = "", year = "", phone = "";

    for (const p0 of rest) {
      const p = (p0 || "").trim(); if (!p) continue;

      if (!mail && U.isEmail(p)) { mail = p; continue; }
      if (!token && U.isHex40(p)) { token = p; continue; }
      if (!raw2fa && U.is2FAKey(p)) { raw2fa = p.toUpperCase(); continue; }
      if (!raw2fa && /2fa\.fb\.rip\//i.test(p)) { raw2fa = extract2FAFromLink(p); continue; }

      const digits = U.onlyDigits(p);
      if (!year && U.isYear(p)) { year = p; continue; }
      if (!phone && U.looksPhone(digits)) { phone = digits.startsWith("+") ? digits : "+" + digits; continue; }

      if (followersRaw === "" && /^\d+$/.test(p) && !U.isYear(p)) { followersRaw = p; continue; }

      if (!mailPass && !U.isEmail(p) && !U.isHex40(p) && !U.is2FAKey(p) && !/2fa\.fb\.rip\//i.test(p) && !U.isYear(p) && !/^\d+$/.test(p)) {
        mailPass = p; continue;
      }
    }

    const lines = [];
    if (user) lines.push(`User: \`${user}\``);
    if (pass) lines.push(`Pass: \`${pass}\``);
    if (phone) lines.push(`Phone: ${phone}`);
    if (mail) lines.push(`Mail: \`${mail}\``);
    if (mail && mailPass) lines.push(`Mail Pass: \`${mailPass}\``);
    if (token) lines.push(`Auth Token: \`${token}\``);
    if (raw2fa) lines.push(`2FA: https://2fa.fb.rip/${raw2fa}`);
    if (year) lines.push(`Joined: ${year}`);

    if (user) {
      let tail = "";
      if (followersRaw !== "" && Number(followersRaw) >= 30) {
        const n = Number(followersRaw);
        tail = ` [${n >= 1000 ? U.formatK(n) : String(n)}]`;
      } else if (phone) {
        tail = ` [${phone}]`;
      }
      lines.push(`Plink: x.com/${user}${tail}`);
    }

    if (forceBlue) {
      lines.push("");
      lines.push("--------------");
      if (year) {
        lines.push(`Never set age less than 14 years from account creation time [${year}] otherwise it'll be locked.`);
      } else {
        lines.push(`Never set age less than 14 years from account creation time otherwise it'll be locked.`);
      }
      lines.push("");
      // Back by request — show Access link inside Blue block
      lines.push("🔸 Access mail:");
      lines.push(App.State.state.mailAccess);
    }
    return lines.join("\n");
  }

  App.Renderers = {
    renderStandardBlock,
    pickFollowersFrom,
    pickUsernameForPlinks,
    extract2FAFromLink
  };
})();