/*
  Support variable field CSV
*/

'use strict';

const CSV = require('comma-separated-values'),
  fs = require('fs');

CSV.prototype.deserialize = {
  string: v => v != null ? String(v) : void 0,
  number: v => v != null ? Number(v) : void 0,
  boolean: v => v != null ? Boolean(v) : void 0
};

module.exports = (path, ext, colsLen) => {
  const DELIMITER = ext === 'csv' ? ',' : '\t';
  var cast = (new Array(colsLen)).fill('String'), // String casting for getting all types.
    content = (new Array(colsLen)).join(DELIMITER) + '\n' + // Dummy line for fixing columns.
      fs.readFileSync(path, 'utf8');
  return CSV.parse(content, {cellDelimiter: DELIMITER, cast: cast}).slice(1);
};
