'use strict';

const fs = require('fs'), pathUtil = require('path'),
  DEFAULT_STORE_DIR = pathUtil.join(__dirname, '../../palettes');

var
  /*
    palettes: {
      <fileName>: {format: <formatId>, path: <path>, ext: <ext>, label: <label>},
      '': {palette: [<color>...], label: <label>} // Default palette
    }
  */
  palettes,
  paletteParser, curStoreDir;

/**
 * @param {Array|function} content - Parsed document or document loader.
 * @returns {string} label - Found label, or `''` if it's not specified.
 * @returns {null} label - The content has no label-field.
 * @returns {boolean} label - false: Invalid `content`.
 */
function parseLabel(content) {
  var data1, matches;
  if (typeof content === 'function') {
    try {
      content = content();
    } catch (error) {
      return false;
    }
  }
  return !content || !Array.isArray(content) || !content.length ? false :
    typeof (data1 = Array.isArray(content[0]) ? content[0][0] : content[0]) === 'string' &&
        (matches = /^@([\s\S]*)$/.exec(data1)) ?
      matches[1].replace(/\s+/g, ' ').trim() : null; // It might include \n
}

/**
 * @param {Array|function} content - Parsed document or document loader.
 * @returns {Array} palette
 */
function parsePalette(content) {
  var label;
  if (typeof content === 'function') {
    try {
      content = content();
    } catch (error) {
      return [];
    }
  }
  if ((label = parseLabel(content)) === false) { return []; }
  return (typeof label === 'string' ? content.slice(1) : content)
    .reduce((palette, element, i) => {
      var paletteElement = paletteParser(element);
      if (paletteElement) {
        if (typeof paletteElement.name !== 'string') {
          paletteElement.name = '#' + (i + 1); // Original number, not number of added color.
        }
        palette.push(paletteElement);
      }
      return palette;
    }, []);
}

const
  FORMATS = {
    json: {
      ext: ['json'],
      loadLabel: path => parseLabel(() => require(path)),
      loadPalette: path => parsePalette(() => require(path))
    },
    yaml: {
      ext: ['yml', 'yaml'],
      loadLabel: path => parseLabel(
        () => require('js-yaml').safeLoad(fs.readFileSync(path, 'utf8'))),
      loadPalette: path => parsePalette(
        () => require('js-yaml').safeLoad(fs.readFileSync(path, 'utf8')))
    },
    csv: {
      ext: ['csv', 'tsv'],
      loadLabel: (path, ext) => parseLabel(
        () => require('./csv-parser.js')(path, ext, 5)), // colLen depends parsePaletteElement()
      loadPalette: (path, ext) => parsePalette(
        () => require('./csv-parser.js')(path, ext, 5)) // colLen depends parsePaletteElement()
    }
  },

  EXT2FORMAT = Object.keys(FORMATS).reduce((ext2format, formatId) => {
    FORMATS[formatId].ext.forEach(ext => {
      ext2format[ext] = formatId;
    });
    return ext2format;
  }, {}),
  RE_FILENAME = new RegExp('^(@)?(.+?)\\.palette\\.(' +
    Object.keys(EXT2FORMAT).map(ext => ext.replace(/[\x00-\x7f]/g, // eslint-disable-line no-control-regex
      s => '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2))).join('|') + ')$', 'i');

exports.init = (storeDir, parser, defaultPalette, defaultPaletteLabel) => {

  function isExists(path) {
    try {
      fs.accessSync(path); // only check existence.
      return true;
    } catch (error) {
      return false;
    }
  }

  function mkdirP(path) { // mkdir -p
    path.split(/\/|\\/).reduce((parents, dir) => {
      var path = pathUtil.resolve((parents += dir + pathUtil.sep)); // normalize
      if (!isExists(path)) {
        fs.mkdirSync(path);
      } else if (!fs.statSync(path).isDirectory()) {
        throw new Error('Non directory already exists: ' + path);
      }
      return parents;
    }, '');
  }

  function copyFiles(srcDir, destDir) {

    function copyFileSync(src, dest) {
      const
        BUFFER_SIZE = 1024 * 64,
        // Check `allocUnsafe` to make sure of the new API.
        buffer = Buffer.allocUnsafe && Buffer.alloc ? Buffer.alloc(BUFFER_SIZE) : new Buffer(BUFFER_SIZE);
      var fdSrc = fs.openSync(src, 'r'),
        fdDest = fs.openSync(dest, 'w'),
        readSize;
      while (true) {
        readSize = fs.readSync(fdSrc, buffer, 0, BUFFER_SIZE);
        if (readSize <= 0) { break; }
        fs.writeSync(fdDest, buffer, 0, readSize);
      }
      fs.closeSync(fdSrc);
      fs.closeSync(fdDest);
    }

    fs.readdirSync(srcDir).forEach(fileName => {
      var srcPath = pathUtil.join(srcDir, fileName),
        destPath = pathUtil.join(destDir, fileName);
      if (fs.statSync(srcPath).isFile()) {
        copyFileSync(srcPath, destPath);
      }
    });
  }

  function parseStoreDir() {
    fs.readdirSync(curStoreDir).forEach(fileName => {
      var path = pathUtil.join(curStoreDir, fileName),
        format, ext, label, baseName, matches;

      if (!fs.statSync(path).isFile() ||
        !(matches = RE_FILENAME.exec(fileName))) { return; }

      baseName = matches[2];
      ext = matches[3].toLowerCase();
      format = EXT2FORMAT[ext];
      if (!matches[1] &&
        (label = FORMATS[format].loadLabel(path, ext)) === false) { return; }

      palettes[fileName] = {
        format: format,
        path: path,
        ext: ext,
        label: label || baseName,
        sortKey: baseName.toLowerCase()
      };
    });
  }

  palettes = {
    '': {
      palette: defaultPalette,
      label: defaultPaletteLabel,
      sortKey: ''
    }
  };

  curStoreDir = storeDir ? pathUtil.resolve(storeDir) : DEFAULT_STORE_DIR;
  paletteParser = parser;
  try {
    if (isExists(curStoreDir)) {
      parseStoreDir();
      if (curStoreDir !== DEFAULT_STORE_DIR && Object.keys(palettes).length <= 1) {
        copyFiles(DEFAULT_STORE_DIR, curStoreDir);
        parseStoreDir();
      }
    } else {
      mkdirP(curStoreDir);
      copyFiles(DEFAULT_STORE_DIR, curStoreDir);
      parseStoreDir();
    }
  } catch (error) { /* ignore */ }
};

exports.getList = () =>
  Object.keys(palettes)
    .sort((a, b) =>
      palettes[a].sortKey > palettes[b].sortKey ? 1 :
      palettes[a].sortKey < palettes[b].sortKey ? -1 : 0)
    .map(fileName => {
      delete palettes[fileName].sortKey;
      return {fileName: fileName, label: palettes[fileName].label};
    });

exports.getPalette = fileName => !fileName || !palettes[fileName] ?
  palettes[''].palette :
  FORMATS[palettes[fileName].format].loadPalette(
    palettes[fileName].path, palettes[fileName].ext);
