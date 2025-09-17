// utils.js (FULL)
(function () {
  window.App = window.App || {};
  const U = {};

  // DOM helper (used by UI / main)
  U.$ = (sel, root = document) => root.querySelector(sel);

  // -------- Validators / recognizers --------
  U.isHex40   = (s) => /^[a-f0-9]{40}$/i.test(s || "");
  U.is2FAKey  = (s) => /^[A-Z0-9]{16}$/.test((s || "").toUpperCase());
  U.isEmail   = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
  U.isYear    = (s) => /^(2007|2008|2009|201\d|202\d|2025)$/.test(s || "");
  U.onlyDigits = (s) => (s || "").replace(/[^\d]/g, "");
  U.looksPhone = (s) => /^\d{10,15}$/.test(U.onlyDigits(s));

  // -------- Number formatting --------
  // 4320 -> "4.32k", 6300 -> "6.3k", <1000 -> "n"
  U.formatK = (n) => {
    if (n == null || isNaN(n)) return "";
    const num = Number(n);
    if (num < 1000) return String(num);
    return (num / 1000).toFixed(2).replace(/\.?0+$/, "") + "k";
  };

  // -------- URL / username helpers --------
  // Accept x.com or twitter.com (any case), allow @, accept http:// or https://,
  // and fix broken "http:// x.com/user" pastes.
  U.extractUsernameAny = (raw) => {
    if (!raw) return "";
    let u = String(raw).trim();
    u = u.replace(/^(https?:\/\/)\s+/i, (_, p) => p); // collapse spaces after protocol
    if (/^https?:$/i.test(u) || /^https?:\/\/?$/i.test(u) || /^www\.?$/i.test(u)) return "";
    const m = u.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]+)/i);
    if (m) return m[1];
    const m2 = u.replace(/^@/, "").match(/^[A-Za-z0-9_]+$/);
    return m2 ? m2[0] : "";
  };

  U.plinkUserRegex = /(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_]+)/ig;

  // -------- Delimiters / splitting --------
  U.detectDelim = (line) => {
    if (line.includes("----")) return "----";
    if (line.includes(":")) return ":";
    if (line.includes(";")) return ";";
    if (line.includes(",")) return ",";
    return ":"; // default
  };

  U.splitFlexible = (line) => {
    const d = U.detectDelim(line);
    return d === "----" ? line.split("----").map(s => s.trim())
                        : line.split(d).map(s => s.trim());
  };

  // -------- Misc shared helpers --------
  U.randToken = (len = 5) => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = ""; for (let i = 0; i < len; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  };

  // Used by main.js earlier; keep a safe passthrough to avoid breaking anything.
  U.coalesceTokenOnlyRows = (text) => text;

  // Sort array of strings like "x.com/user [2.40k]" by numeric count desc
  U.sortLinesByCount = (lines) => {
    const grab = (s) => {
      const m = s.match(/\[(\d+(?:\.\d+)?)k\]|\[(\d+)\]/i);
      if (!m) return -1;
      if (m[1]) return parseFloat(m[1]) * 1000;
      return parseInt(m[2], 10);
    };
    return [...lines].sort((a, b) => grab(b) - grab(a));
  };

  // Export
  App.Utils = U;
})();