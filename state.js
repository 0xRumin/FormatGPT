// state.js (FULL)
(function () {
  window.App = window.App || {};
  const { DEFAULT_MAIL } = (window.App.Config || { DEFAULT_MAIL: "https://firstmail.ltd/en-US/webmail" });

  function normalizeMailAccess(s) {
    const v = (s || "").trim();
    if (!v) return DEFAULT_MAIL;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/\//.test(v)) return "https:" + v;
    return "https://" + v;
  }

  function parseJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  const state = {
    blue: false,
    addMail: false,
    chunkMode: localStorage.getItem("chunkMode") === "1",
    mailAccess: normalizeMailAccess(localStorage.getItem("mailAccess") || DEFAULT_MAIL),
    mode: "standard",
    reorderFields:  parseJSON("reorderFields"),
    reorderEnabled: parseJSON("reorderEnabled"),
    reorderSep:     localStorage.getItem("reorderSep") || ":",
    reorderPreset:  localStorage.getItem("reorderPreset") || "original",
    filterUsernames: localStorage.getItem("filterUsernames") || "",
    filterView:      localStorage.getItem("filterView") || "both",
    sorterColumn:    parseInt(localStorage.getItem("sorterColumn") || "0", 10) || 0,
    sorterOrder:     localStorage.getItem("sorterOrder") || "desc",
    sorterForce:     localStorage.getItem("sorterForce") === "1",
  };

  function setMailAccess(v) {
    state.mailAccess = normalizeMailAccess(v);
    localStorage.setItem("mailAccess", state.mailAccess);
  }

  function initState() { /* room for future */ }

  window.App.State = { state, setMailAccess, initState, normalizeMailAccess };
})();