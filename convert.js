// Convert usernames mode 
(function(){
  const { splitFlexible, sortLinesByCount, formatK } = App.Utils;

  function extractUsernameAny(s){
    if(!s) return '';
    let t = String(s).trim().replace(/^@/,'');
    const m = t.match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_\.]+)/i);
    if(m) return m[1];
    const m2 = t.match(/^[A-Za-z0-9_\.]+$/);
    return m2 ? m2[0] : '';
  }
  function parseFlexibleCountToken(tok){
    if(!tok) return null;
    const t = String(tok).replace(/^[\[\(\s]+|[\]\)\s]+$/g, '').replace(/,/g,'');
    const m = t.match(/^(\d+(?:\.\d+)?)([kK])?$/);
    if(!m) return null;
    const n = parseFloat(m[1]);
    return m[2] ? n*1000 : n;
  }
  function extractCountFromTokens(tokens){
    for(const raw of tokens){
      const bits = String(raw).split(/[:;,]/).map(s=>s.trim()).filter(Boolean);
      for(const b of bits){
        const n = parseFlexibleCountToken(b);
        if(n!=null) return n;
      }
    }
    return null;
  }

  App.App.registerMode({
    id: 'convert',
    label: 'Convert usernames',
    run(text){
      const rows=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      let out=[];
      for(const row of rows){
        const parts=splitFlexible(row);
        let uname='';
        for(const token of parts){ if(!uname){ const u=extractUsernameAny(token); if(u) uname=u; } }
        if(!uname){ out.push('x.com/'); continue; }
        const count = extractCountFromTokens(parts);
        const countStr = (count==null) ? '' : ` [${formatK(count)}]`;
        out.push(`x.com/${uname}${countStr}`);
      }
      out = sortLinesByCount(out);
      return out.join('\n');
    }
  });
})();
