/* Regenerates js/data.js (embedded fallback bundle) from data/nodes.json + data/keys.json
   so Alpaca keeps running over file:// even though the app prefers the real JSON over http(s). */
const fs = require('fs');
const ROOT = 'C:/Users/Ramadan/Desktop/alpaca';
const db = JSON.parse(fs.readFileSync(ROOT + '/data/nodes.json', 'utf8'));
const keys = JSON.parse(fs.readFileSync(ROOT + '/data/keys.json', 'utf8'));

const banner = '/* Auto-generated fallback bundle (mirrors data/*.json) so Alpaca runs even over file://. Served over http(s) the app prefers the real JSON files. */\n';

const out =
  banner +
  '\nwindow.ALPACA_DB = ' +
  JSON.stringify({ vectorspace: db.vectorspace, nodes: db.nodes, pages: db.pages || {} }, null, 2) +
  ';\n\nwindow.ALPACA_KEYS = ' +
  JSON.stringify(keys, null, 2) +
  ';\n';

fs.writeFileSync(ROOT + '/js/data.js', out, 'utf8');
console.log('data.js written: ' + out.length + ' bytes');