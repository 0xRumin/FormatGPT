// Renderers 
(function(){
  window.App = window.App || {};
  const { FOLLOWERS_MIN } = App.Config;
  const {
    isEmail, isHex40, is2FAKey, extract2FAFromLink, isYear, isPhone, splitFlexible, isCt0, normalizeUser
  } = App.Utils;
  const { state } = App.State;

  function pickUsernameForPlinks(parts){
    for(const t of parts){
      const m = String(t).match(/(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/@?([A-Za-z0-9_\.]+)/i);
      if(m) return m[1];
    }
    for(const t0 of parts){
      const t = String(t0).trim();
      if(!t) continue;
      if(isEmail(t) || isHex40(t) || is2FAKey(t) || /2fa\.fb\.rip\//i.test(t) || isYear(t) || /^\d+$/.test(t) || isCt0(t)) continue;
      if(/^0x/i.test(t)) return t;
      const m2 = t.match(/^\d+([A-Za-z0-9_\.].*)$/);
      return m2 ? m2[1] : t;
    }
    return (parts[0]||'').trim();
  }

  function pickFollowersFrom(tokens){
    for(const t of tokens){
      const v=(t||'').trim();
      if(!/^\d+$/.test(v)) continue;
      if(isYear(v)) continue;
      if(isPhone(v)) continue;
      if(Number(v)>=FOLLOWERS_MIN) return v;
    }
    return '';
  }

  function parseFormattedBlock(lines){
    const get = (label)=> {
      const row = lines.find(l => l.toLowerCase().startsWith(label));
      if(!row) return '';
      const val = row.slice(label.length).trim();
      return val.replace(/^`|`$/g,'');
    };
    let user = get('user:');
    let pass = get('pass:');
    let mail = get('mail:');
    let mailPass = get('mail pass:');
    let token = get('auth token:');
    let twofa = get('2fa:');
    const joined = get('joined:');
    const plink = get('plink:');

    if(isCt0(token)) token = '';
    const m = twofa.match(/2fa\.fb\.rip\/([A-Z0-9]{16})/i);
    if(m) twofa = m[1];

    let followers = '';
    const f = plink.match(/\[(\d+)\]\s*$/);
    if(f) followers = f[1];

    return {user, pass, mail, mailPass, token, twofa, followers, joined};
  }

  function joinReverse(arr){
    const filtered = arr.filter(v => v!=null && String(v)!=='');
    return filtered.join(':');
  }

  function renderStandard(parts){
    let arr = Array.isArray(parts)? parts.slice() : [];
    while (arr.length && isCt0(arr[0])) arr.shift();
    if (arr.length===1 && isHex40(arr[0])) arr = ['', '', arr[0]];
    if (arr.length===2 && !arr[0] && isHex40(arr[1])) arr = ['', '', arr[1]];

    let [user, pass, ...rest] = arr;
    user = normalizeUser(user||'');
    pass = pass || '';

    let mail='', mailPass='', token='', raw2fa='', followersRaw='', year='', phone='';
    for(const p0 of rest){
      const p=(p0||'').trim(); if(!p) continue;
      if(isCt0(p)) continue;

      if(!mail && isEmail(p))                  { mail=p; continue; }
      if(!token && isHex40(p))                 { token=p; continue; }
      if(!raw2fa && is2FAKey(p))               { raw2fa=p; continue; }
      if(!raw2fa && /2fa\.fb\.rip\//i.test(p)) { raw2fa=extract2FAFromLink(p); continue; }
      if(!year && isYear(p))                   { year=p; continue; }

      if(!phone && /^\d+$/.test(p) && isPhone(p)) { phone=p; continue; }
      if(followersRaw==='' && /^\d+$/.test(p) && !isPhone(p) && !isYear(p)) { followersRaw=p; continue; }

      if(!mailPass && !isEmail(p) && !isHex40(p) && !is2FAKey(p)
        && !/2fa\.fb\.rip\//i.test(p) && !isYear(p) && !/^\d+$/.test(p)){ mailPass=p; continue; }
    }

    const lines=[];
    if(user) lines.push(`User: \`${user}\``);
    if(pass) lines.push(`Pass: \`${pass}\``);
    if(mail) lines.push(`Mail: \`${mail}\``);
    if(mail && mailPass) lines.push(`Mail Pass: \`${mailPass}\``);
    if(phone){
      const pshow = phone.startsWith('+') ? phone : ('+'+phone);
      lines.push(`Phone: \`${pshow}\``);
    }
    if(token) lines.push(`Auth Token: \`${token}\``);
    if(raw2fa) lines.push(`2FA: https://2fa.fb.rip/${raw2fa}`);
    if(year)   lines.push(`Joined: ${year}`);
    if(user){
      const tail=(followersRaw!=='' && Number(followersRaw)>=FOLLOWERS_MIN)?` [${followersRaw}]`:'';
      lines.push(`Plink: x.com/${user}${tail}`);
    }

    if(state.blue){
      lines.push('');
      lines.push('--------------');
      lines.push(year
        ? `Never set age less than 14 years from account creation time [${year}] otherwise it'll be locked.`
        : `Never set age less than 14 years from account creation time otherwise it'll be locked.`
      );
      lines.push('');
      lines.push('🔸 Mail Access:');
      lines.push(state.mailAccess);
    }
    return lines.join('\n');
  }

  App.Renderers = {
    pickUsernameForPlinks, pickFollowersFrom,
    parseFormattedBlock, joinReverse,
    renderStandard
  };
})();
