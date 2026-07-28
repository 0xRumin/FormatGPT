// Config values 
(function(){
  window.App = window.App || {};
  App.Config = {
    DEFAULT_MAIL: 'https://firstmail.ltd/en-US/webmail',
    // Seed list for the Mail Access URL manager (Settings). Used the first time
    // (no saved list yet) and by "Reset All". Any previously saved single URL is
    // migrated in and kept as the active one.
    DEFAULT_MAIL_LIST: [
      'https://mail.tm',
      'https://firstmail.ltd/webmail/login/'
    ],
    FOLLOWERS_MIN: 30,
    PHONE_MIN: 10,
    PHONE_MAX: 15
  };
})();
