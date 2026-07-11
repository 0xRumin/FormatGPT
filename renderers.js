// renderers.js (FULL)
(function () {
  window.App = window.App || {};
  const U = App.Utils;
  const { state } = App.State;

  
  const extract2FAFromLink = (s) => {
    // Accept either old 2fa.fb.rip/<KEY> links or new browserscan.net/2fa#<KEY> links
    const m = String(s || "").match(/(?:2fa\.fb\.rip\/|(?:www\.)?browserscan\.net\/2fa#)([A-Z0-9]{16})/i);
    return m ? m[1].toUpperCase() : "";
  };

  // Followers count sanity range: real X/Twitter accounts almost never exceed
  // 500k followers in these dumps. Anything >= 500k is far more likely a
  // numeric mail password (e.g. 29377332), so we refuse to classify it as
  // followers — it falls through to the mailPass slot instead.
  const FOLLOWERS_MAX = 500000;

  function pickFollowersFrom(tokens, allowShortFirst) {
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const v = (t || "").trim();
      if (!/^\d+$/.test(v)) continue;
      if (U.isYear(v)) continue;
      const n = Number(v);
      if (allowShortFirst && i === 0 && U.isShortNumericField(v) && n < FOLLOWERS_MAX) return v;
      if (n >= 30 && n < FOLLOWERS_MAX) return v;
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
    const credentials = U.credentialParts(parts);
    let user = credentials.username;
    let pass = credentials.password;
    const rest = credentials.rest;

    let mail = "", mailPass = "", token = "", raw2fa = "", followersRaw = "", year = "", phone = "";
    let refreshToken = "", clientId = "";

    // Detect the pipe-delimited mail chunk:
    //   mail|mailpass|refresh_token|clientID
    // First segment must be an email; if matched, all 4 sub-fields are pulled
    // out here and the chunk is skipped in the main loop below.
    for (let i = 0; i < rest.length; i++) {
      const p = (rest[i] || "").trim();
      if (!p || p.indexOf("|") < 0) continue;
      const sub = p.split("|");
      if (sub.length < 2) continue;
      const first = (sub[0] || "").trim();
      if (!U.isEmail(first)) continue;

      if (state.chunkMode) {
        // Chunk Mode: keep the whole mail chunk
        //   email|mailpass|refresh_token|clientID
        // intact as a single Mail field (needed as one unit for mail reading)
        // instead of splitting it into Mail / Mail Pass / Refresh / Client ID.
        mail = p;
      } else {
        mail         = first;
        mailPass     = (sub[1] || "").trim() || mailPass;
        refreshToken = (sub[2] || "").trim() || refreshToken;
        clientId     = (sub[3] || "").trim() || clientId;
      }
      // Blank out so the main loop skips this position
      rest[i] = "";
      break;
    }

    for (const p0 of rest) {
      const p = (p0 || "").trim(); if (!p) continue;

      if (!mail && U.isEmail(p)) { mail = p; continue; }
      if (!token && U.isHex40(p)) { token = p; continue; }
      if (!raw2fa && U.is2FAKey(p)) { raw2fa = p.toUpperCase(); continue; }
      if (!raw2fa && /(?:2fa\.fb\.rip\/|browserscan\.net\/2fa#)/i.test(p)) { raw2fa = extract2FAFromLink(p); continue; }

      const digits = U.onlyDigits(p);
      if (!year && U.isYear(p)) { year = p; continue; }
      if (!phone && U.looksPhone(digits)) { phone = digits.startsWith("+") ? digits : "+" + digits; continue; }

      // Numeric token — decide between followers count and a numeric mail pass.
      // Followers: 30 ≤ n < 500k. Anything outside that range (esp. huge
      // numbers like 29377332) is treated as a mail password candidate.
      if (/^\d+$/.test(p) && !U.isYear(p)) {
        const n = Number(p);
        const positionalShortCount = credentials.secondIsShortNumeric && p === rest[0];
        if (followersRaw === "" && n < FOLLOWERS_MAX && (n >= 30 || positionalShortCount)) {
          followersRaw = p;
          continue;
        }
        if (!mailPass && p.length <= 32) {
          mailPass = p;
          continue;
        }
        continue;
      }

      if (!mailPass && p.length <= 32 && !U.isEmail(p) && !U.isCt0(p) && !U.isHex40(p) && !U.is2FAKey(p) && !/2fa\.fb\.rip\//i.test(p) && !U.isYear(p)) {
        mailPass = p; continue;
      }
    }

    const lines = [];
    if (user) lines.push(`User: \`${user}\``);
    if (pass) lines.push(`Pass: \`${pass}\``);
    if (phone) lines.push(`Phone: ${phone}`);
    if (mail) lines.push(`Mail: \`${mail}\``);
    if (mail && mailPass) lines.push(`Mail Pass: \`${mailPass}\``);
    if (refreshToken) lines.push(`Refresh Token: \`${refreshToken}\``);
    if (clientId) lines.push(`Client ID: \`${clientId}\``);
    if (token) lines.push(`Auth Token: \`${token}\``);
    if (raw2fa) lines.push(`2FA: https://www.browserscan.net/2fa#${raw2fa}`);
    if (year) lines.push(`Joined: ${year}`);

    if (user) {
      let tail = "";
      // Show follower counts when a numeric followers value is present.
      // Otherwise, if year is present, show year in the Plink tail.
      // Do not use phone as a fallback for the Plink count.
      if (followersRaw !== "") {
        const n = Number(followersRaw);
        tail = ` [${n >= 1000 ? U.formatK(n) : String(n)}]`;
      } else if (year) {
        tail = ` [${year}]`;
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
