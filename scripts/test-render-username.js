const fs = require('fs');
const vm = require('vm');

// Emulate browser globals expected by the scripts
global.window = global;
global.document = {};

// Load utils.js into this context to populate App.Utils
const utilsCode = fs.readFileSync('utils.js', 'utf8');
vm.runInThisContext(utilsCode, { filename: 'utils.js' });

// Provide minimal App.State used by renderers when forceBlue is used
global.App.State = { state: { mailAccess: 'https://mail.example' } };

// Load renderers.js
const renderersCode = fs.readFileSync('renderers.js', 'utf8');
vm.runInThisContext(renderersCode, { filename: 'renderers.js' });

// Sample input from the screenshot
const line = '2009Hnoo:I63vZedhA:nbkaxoxm@duhastmail.com:rhakhrtgX!4186:6e8bd0649604ca960d7c24e013287580b5f96461:QQAS1ZGNAG2BAAXT:92:2012';
const parts = line.split(':');

const out = App.Renderers.renderStandardBlock(parts, false);
console.log(out);
