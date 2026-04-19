const fs = require('fs');
const vm = require('vm');

global.window = { App: { State: { state: { mailAccess: 'MAIL_ACCESS' } } } };

action = (file) => {
  const code = fs.readFileSync(file, 'utf8');
  vm.runInThisContext(code, { filename: file });
};

const base = 'd:/SCRIPTS/FormatGPT';
action(base + '/utils.js');
action(base + '/renderers.js');
action(base + '/xfly.js');
action(base + '/reverse.js');

const { extract2FAFromLink, renderStandardBlock } = window.App.Renderers;

const samples = [
  'https://2fa.fb.rip/ABCDEF1234567890',
  'http://2fa.fb.rip/abcdef1234567890',
  'https://browserscan.net/2fa#ABCDEF1234567890',
  'https://www.browserscan.net/2fa#abcdef1234567890',
  'browserscan.net/2fa#abcdef1234567890',
];

console.log('Testing extract2FAFromLink:');
for (const s of samples) {
  console.log(s, '->', extract2FAFromLink(s));
}

console.log('\nTesting renderStandardBlock:');
const out = renderStandardBlock(['user','pass','https://www.browserscan.net/2fa#abcDEF1234567890']);
console.log(out);

console.log('\nTesting xfly mode run:');
const res = window.App.App && window.App.App.registerMode ? 'modes registered' : 'no modes';
console.log(res);

// Try using xfly run directly
const xflyReg = window.App.App && window.App.App._modes ? window.App.App._modes.find(m => m.id === 'xfly') : null;
// The registerMode implementation in app.js pushes to App.App._modes; if not present, skip
if (xflyReg && xflyReg.run) {
  console.log('\nxfly run sample:', xflyReg.run('u:p:https://www.browserscan.net/2fa#ABCDEF1234567890'));
} else {
  console.log('\nxfly mode not available to run in this environment (registerMode may differ).');
}
