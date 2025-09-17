// mail-changer.js
(function () {
  const U = App.Utils;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'mailChanger',
    label: 'Mail Changer',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const out = [];
      
      for (const row of rows) {
        // Split by colon and trim each part
        const parts = row.split(':').map(part => part.trim()).filter(part => part);
        
        if (parts.length < 3) {
          out.push("Invalid format: Need at least username:password:email");
          continue;
        }
        
        // Extract the core fields
        const id = parts[0];      // First position is always ID/username
        const pass = parts[1];    // Second position is always password
        const mail = parts[2];    // Third position is always email
        
        // Look for auth token (could be in various positions)
        let auth = "";
        for (let i = 3; i < parts.length; i++) {
          const part = parts[i];
          // Check if this part looks like an auth token (hex40 or 2FA)
          if (U.isHex40(part) || U.is2FAKey(part)) {
            auth = part;
            break;
          }
        }
        
        // Build the normalized output
        const normalized = auth ? `${id}:${pass}:${mail}:${auth}` : `${id}:${pass}:${mail}`;
        out.push(normalized);
      }
      
      return out.join("\n");
    }
  });
})();