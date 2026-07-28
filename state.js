// state.js (FULL)
(function () {
  window.App = window.App || {};
  const CFG = window.App.Config || {};
  const DEFAULT_MAIL = CFG.DEFAULT_MAIL || "https://firstmail.ltd/en-US/webmail";
  const DEFAULT_MAIL_LIST = Array.isArray(CFG.DEFAULT_MAIL_LIST) && CFG.DEFAULT_MAIL_LIST.length
    ? CFG.DEFAULT_MAIL_LIST : [DEFAULT_MAIL];

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

  // De-duplicate (preserving order) after normalizing every entry.
  function dedupeMails(list) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach(function (u) {
      const n = normalizeMailAccess(u);
      if (n && out.indexOf(n) < 0) out.push(n);
    });
    return out;
  }

  // Build the initial saved-URL list. Migrates a pre-existing single "mailAccess"
  // value (kept first, so it stays the active one) and seeds the defaults.
  function initialMailList() {
    const saved = parseJSON("mailAccessList");
    let list = (Array.isArray(saved) && saved.length) ? saved.slice() : null;
    if (!list) {
      list = [];
      const oldSingle = localStorage.getItem("mailAccess");
      if (oldSingle) list.push(oldSingle);
      DEFAULT_MAIL_LIST.forEach(function (u) { list.push(u); });
    }
    list = dedupeMails(list);
    if (!list.length) list.push(DEFAULT_MAIL);
    return list;
  }

  const mailAccessList = initialMailList();
  let activeMail = localStorage.getItem("mailAccess");
  activeMail = activeMail ? normalizeMailAccess(activeMail) : mailAccessList[0];
  if (mailAccessList.indexOf(activeMail) < 0) activeMail = mailAccessList[0];

  // Persist the (possibly migrated/seeded) list immediately so it "sticks"
  // globally from the first load, even before the user opens Settings.
  try {
    localStorage.setItem("mailAccessList", JSON.stringify(mailAccessList));
    localStorage.setItem("mailAccess", activeMail);
  } catch (e) {}

  const state = {
    blue: false,
    addMail: false,
    chunkMode: localStorage.getItem("chunkMode") === "1",
    mailAccess: activeMail,
    mailAccessList: mailAccessList,
    mode: "standard",
    reorderFields:  parseJSON("reorderFields"),
    reorderEnabled: parseJSON("reorderEnabled"),
    reorderSep:     localStorage.getItem("reorderSep") || ":",
    reorderPreset:  localStorage.getItem("reorderPreset") || "original",
    reorderPersist: localStorage.getItem("reorderPersist") === "1",
    filterUsernames: localStorage.getItem("filterUsernames") || "",
    filterView:      localStorage.getItem("filterView") || "both",
    sorterColumn:    parseInt(localStorage.getItem("sorterColumn") || "0", 10) || 0,
    sorterOrder:     localStorage.getItem("sorterOrder") || "desc",
    sorterForce:     localStorage.getItem("sorterForce") === "1",
  };

  // Set the active URL, ensuring it's part of the saved list.
  function setMailAccess(v) {
    const url = normalizeMailAccess(v);
    state.mailAccess = url;
    if (state.mailAccessList.indexOf(url) < 0) state.mailAccessList.push(url);
    localStorage.setItem("mailAccess", url);
    localStorage.setItem("mailAccessList", JSON.stringify(state.mailAccessList));
  }

  // Replace the whole saved list and choose the active URL. Persisted to
  // localStorage so the set is global and permanent (survives reloads/days).
  function setMailAccessList(list, active) {
    const clean = dedupeMails(list);
    state.mailAccessList = clean.length ? clean : [DEFAULT_MAIL];
    let act = active ? normalizeMailAccess(active) : state.mailAccessList[0];
    if (state.mailAccessList.indexOf(act) < 0) act = state.mailAccessList[0];
    state.mailAccess = act;
    localStorage.setItem("mailAccessList", JSON.stringify(state.mailAccessList));
    localStorage.setItem("mailAccess", state.mailAccess);
  }

  function initState() { /* room for future */ }

  window.App.State = { state, setMailAccess, setMailAccessList, initState, normalizeMailAccess };
})();