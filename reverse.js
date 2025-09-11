// Reverse mode 
(function(){
  const { splitFlexible, extract2FAFromLink, isCt0 } = App.Utils;
  const { parseFormattedBlock, joinReverse } = App.Renderers;

  App.App.registerMode({
    id: 'reverse',
    label: 'Reverse',
    run(text){
      const chunks = text.replace(/\r/g,'').split(/\n\s*(?:-{6,}\s*)?\n+/).map(ch=>ch.trim()).filter(Boolean);
      const out=[];
      for(const chunk of chunks){
        const rws = chunk.split(/\n/).map(r=>r.trim()).filter(Boolean);
        const looksBlock = rws.some(r => /^user:/i.test(r));
        if(looksBlock){
          const {user,pass,mail,mailPass,token,twofa,followers,joined}=parseFormattedBlock(rws);
          if(!user && !pass){ out.push('Sorry, invalid format for reverse.'); continue; }
          out.push(joinReverse([user,pass,mail,mailPass,token,twofa,followers,joined]));
        }else{
          const hasDelims = rws.some(r => /:|;|,|----/.test(r));
          if(!hasDelims && rws.length>=2 && rws.length<=8){
            let parts=rws.slice(0,8).filter(x=>!isCt0(x));
            for(let i=0;i<parts.length;i++){ if(/2fa\.fb\.rip\//i.test(parts[i])) parts[i]=extract2FAFromLink(parts[i]); }
            while(parts.length<8) parts.push('');
            out.push(joinReverse(parts));
          }else{
            for(const line of rws){
              let parts=splitFlexible(line).filter(x=>!isCt0(x));
              for(let i=0;i<parts.length;i++){ if(/2fa\.fb\.rip\//i.test(parts[i])) parts[i]=extract2FAFromLink(parts[i]); }
              if(parts.length<2){ out.push('Sorry, invalid format for reverse.'); continue; }
              const arr=parts.slice(0,8); while(arr.length<8) arr.push('');
              out.push(joinReverse(arr));
            }
          }
        }
      }
      return out.join('\n');
    }
  });
})();
