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

const { renderStandardBlock } = window.App.Renderers;

const samples = [
  ['abidrana390','RgnitE4kZ', '+8801757077624', '98efca09c8f463882284d7e5c55ab5ed9712776e', 'TYDRFI05V7ZK4666'],
  ['abidrana390','RgnitE4kZ', '+8801757077624'],
  ['abidrana390','RgnitE4kZ', '42'],
  ['abidrana390','RgnitE4kZ', '5'],
  ['Grkem010','aVSJ0T8y7','2020','92'],
  ['Grkem010','aVSJ0T8y7','2020'],
  ['abidrana390','RgnitE4kZ'],
];

console.log('Testing renderStandardBlock for Plink counts:');
for (const s of samples) {
  const parts = [s[0], s[1]];
  if (s[2]) parts.push(s[2]);
  if (s[3]) parts.push(s[3]);
  if (s[4]) parts.push(s[4]);
  console.log('\nInput parts:', parts.join(':'));
  console.log(renderStandardBlock(parts));
}
