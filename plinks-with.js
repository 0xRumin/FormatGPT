// Plinks With Counts mode 
(function(){
  const { splitFlexible, sortLinesByCount } = App.Utils;
  const { pickUsernameForPlinks, pickFollowersFrom } = App.Renderers;

  App.App.registerMode({
    id: 'plinksWith',
    label: 'Plinks with counts',
    run(text){
      const rows=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      let out=[];
      for(const row of rows){
        const parts=splitFlexible(row);
        const user=pickUsernameForPlinks(parts);
        if(!user) return "Sorry, invalid format for plinks.\nExpected: user:pass:... (username required)";
        const rest = parts.filter(p => p !== user);
        const followersRaw=pickFollowersFrom(rest);
        const showCount=followersRaw!=='' && Number(followersRaw)>=30;
        out.push(`x.com/${user}${showCount?` [${followersRaw}]`:''}`);
      }
      out = sortLinesByCount(out);
      return out.join('\n');
    }
  });
})();
