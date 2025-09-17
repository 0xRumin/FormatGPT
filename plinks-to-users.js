// plinks-to-users.js
(function () {
  const U = App.Utils;

  App.App = App.App || {};
  App.App.registerMode({
    id: 'plinksToUsers',
    label: 'Plinks → Usernames',
    run(text) {
      const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const usernames = new Set(); // Use Set to automatically handle duplicates
      
      for (const row of rows) {
        // Extract username from various plink formats
        const username = U.extractUsernameAny(row);
        if (username) {
          usernames.add(username);
        }
      }
      
      // Convert Set to Array and sort alphabetically
      const sortedUsernames = Array.from(usernames).sort();
      
      return sortedUsernames.join("\n");
    }
  });
})();