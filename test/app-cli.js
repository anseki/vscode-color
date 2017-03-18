
'use strict';

const
  processBridge = require('process-bridge'),
  ARGS = [require('path').join(__dirname, '../lib/app')],
  RE_MESSAGE_LINE = /^([^\n\r]*)[\n\r]+([\s\S]*)$/,

  FORM_KEYS = { // largePalette / simple / compact / compact2 / byPalette
    lp: 'largePalette',
    s: 'simple',
    c: 'compact',
    c2: 'compact2',
    bp: 'byPalette'
  };

let stdioData = '';

function parseMessageLines(lines, cb) { // cb(requestId, message)
  let matches, line;
  RE_MESSAGE_LINE.lastIndex = 0;
  while ((matches = RE_MESSAGE_LINE.exec(lines))) {
    line = matches[1];
    lines = matches[2];
    if (line === '') { continue; }
    cb(line); // eslint-disable-line callback-return
  }
  return lines;
}

console.log('Input value to send or `q` to quit.');
console.log('\'\' : empty value\n' +
  '<value1>@<value2>@.../c:<formatId> : convert\n' +
  '<value>/f:<form> :\n' +
    Object.keys(FORM_KEYS).map(key => `  ${key}: ${FORM_KEYS[key]}`).join('') + '\n' +
  '<value>/s:<storeDir>');

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  stdioData = parseMessageLines(stdioData + chunk, value => {
    if (value === 'q') {
      processBridge.closeHost();
      setTimeout(() => {
        process.exit(); // eslint-disable-line no-process-exit
      }, 500);
    } else {
      let request = {value: value, command: 'pick'}, matches;
      if ((matches = /^(.*?)\/c:(.+)$/.exec(value))) {
        request.value = matches[1].split('@');
        request.formatId = matches[2];
        request.command = 'convert';
      } else if ((matches = /^(.*?)\/f:(.+)$/.exec(value))) {
        request.value = matches[1];
        request.form = FORM_KEYS[matches[2]];
      } else if ((matches = /^(.*?)\/s:(.+)$/.exec(value))) {
        request.value = matches[1];
        request.storeDir = matches[2];
      }
      if (request.value === "''" || request.value === '""') { request.value = ''; }

      processBridge.sendRequest(request, ARGS, (error, message) => {
        if (error) {
          if (error.isRetried) { return; }
          throw error;
        }
        console.log('RESULT FROM HOST: ' + JSON.stringify(message));
      });
    }
  });
});
process.stdin.on('error', error => { throw error; });
process.stdin.on('close', () => { process.exit(); }); // eslint-disable-line no-process-exit
