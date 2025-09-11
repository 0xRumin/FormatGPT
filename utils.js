// js/utils.js
(function () {
  window.App = window.App || {};

  // ---------- Config ----------
  const Config = {
    PHONE_MIN: 10,
    PHONE_MAX: 15,
    DEFAULT_MAIL: "https://firstmail.ltd/en-US/webmail"
  };

  // ---------- Utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function detectDelim(line) {
    if (line.includes("----")) return "----";
    if (line.includes(":")) return ":";
    if (line.includes(";")) return ";";
    if (line.includes(",")) return ",";
    return ":"; // default
  }
  function splitFlexible(line) {
    const d = detectDelim(line);
    return d === "----"
      ? line.split("----").map(s => s.trim())
      : line.split(d).map(s => s.trim());
  }

  const isHex40  = s => /^[a-f0-9]{40}$/i.test(s||"");
  const is2FAKey = s => /^[A-Z0-9]{16}$/.test((s||"").toUpperCase());
  const isEmail  = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||"");
  const isYear   = s => /^(2007|2008|2009|201\d|202\d|2025)$/.test(s||"");
  const looksPhone = s => {
    const d=(s||"").replace(/[^\d]/g,"");
    return d.length>=Config.PHONE_MIN && d.length<=Config.PHONE_MAX;
  };
  const addPlus = d => d.startsWith("+")?d:("+"+d);
  const stripLeadingNumbersForStandard = s => (s||"").replace(/^\d+/, "");
  const extract2FAFromLink = s => {
    const m = String(s||"").match(/2fa\.fb\.rip\/([A-Z0-9]{16})/i);
    return m ? m[1].toUpperCase() : "";
  };
  function randomName(len=6){
    const chars="abcdefghijklmnopqrstuvwxyz0123456789"; let x="";
    for(let i=0;i<len;i++) x+=chars[(Math.random()*chars.length)|0];
    return x;
  }

  App.Config = Config;
  App.Utils = {
    $, $$, detectDelim, splitFlexible,
    isHex40, is2FAKey, isEmail, isYear,
    looksPhone, addPlus, stripLeadingNumbersForStandard, extract2FAFromLink,
    randomName
  };
})();