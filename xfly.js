// Xfly mode 
(function(){
  const { splitFlexible, is2FAKey, extract2FAFromLink, isCt0, normalizeUser } = App.Utils;

  App.App.registerMode({
    id: 'xfly',
    label: 'Xfly',
    run(text){
      const rows=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const out=[];
      for(const row of rows){
        const p=splitFlexible(row).filter(x=>!isCt0(x));
        let [user,pass,...rest]=p; user=normalizeUser(user||'');
        let key=rest.find(x=>is2FAKey(x));
        if(!key){const link=rest.find(x=>/2fa\.fb\.rip\//i.test(x||'')); if(link) key=extract2FAFromLink(link)}
        if(!user||!pass||!key) out.push("Sorry, invalid format for xfly.\nExpected: username:password:RAW2FAKEY (16 A–Z/0–9; 2FA link accepted).");
        else out.push(`${user}:${pass}:${key}`);
      }
      return out.join('\n');
    }
  });
})();
