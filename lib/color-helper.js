
'use strict';

const
  vscode = require('vscode'),
  Position = vscode.Position,
  Selection = vscode.Selection,

  COMMAND_ID = 'extension.colorHelper',
  CSS_FUNCS = ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'gray', 'device-cmyk', 'color'],
  // https://drafts.csswg.org/css-color/#named-colors
  CSS_KEYWORDS = require('./css-colors.json').reduce((keywords, color) => {
    if (color.name) { keywords.push(color.name); }
    if (color.alias) { keywords = keywords.concat(color.alias); }
    return keywords;
  }, []),

  PTN_SINGLE_PAREN = '\\([^\\(]*?\\)',
  RE_SINGLE_PAREN = new RegExp(PTN_SINGLE_PAREN, 'g'),
  RE_CSS_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi,
  RE_CSS_KEYWORDS = new RegExp('\\b(?:' +
    CSS_KEYWORDS.map(text => text.replace(/[\x00-\x7f]/g,
      s => '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2))).join('|') +
    ')\\b', 'gi'),
  RE_CSS_FUNC = new RegExp('\\b(?:' +
    CSS_FUNCS.map(text => text.replace(/[\x00-\x7f]/g,
      s => '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2))).join('|') +
    ') *' + PTN_SINGLE_PAREN, 'gi'),
  RE_CSS_COMMENT = /\/\*[\s\S]*?\*\//g,
  RE_DOC_LINE = /^.*?(?:\r\n|\n|\r|$)/gm,

  ARGS = [require('path').join(__dirname, 'app.asar')],
  MSG_BLINK_TIME_ON = 1000, MSG_BLINK_TIME_OFF = 200;

var uiMessage, uiMessageText, messageTimer, processBridge;

function getColorSelections(textEditor) {
  var colorSelections = [], linesLen = [], doc, matches;

  // index of content -> index of line and character
  function getPosition(index) {
    var lineIndex = -1;
    while (++lineIndex < linesLen.length - 1 && index >= linesLen[lineIndex]) {
      index -= linesLen[lineIndex];
    }
    return new Position(lineIndex, index);
  }

  doc = textEditor.document.getText();
  // Get length of each line
  RE_DOC_LINE.lastIndex = 0;
  while ((matches = RE_DOC_LINE.exec(doc))) {
    linesLen.push(matches[0].length);
    if (RE_DOC_LINE.lastIndex >= doc.length) { break; }
  }

  // Lookup CSS comments
  doc = doc.replace(RE_CSS_COMMENT, comment => ' '.repeat(comment.length))
  // Lookup hex values
  .replace(RE_CSS_HEX, (match, offset) => {
    var strLen = match.length;
    colorSelections.push(new Selection(getPosition(offset), getPosition(offset + strLen)));
    return ' '.repeat(strLen);
  })
  // Lookup keywords
  .replace(RE_CSS_KEYWORDS, (match, offset) => {
    var strLen = match.length;
    colorSelections.push(new Selection(getPosition(offset), getPosition(offset + strLen)));
    return ' '.repeat(strLen);
  });
  // Lookup functions
  (() => { // recursive pattern and code pattern are not supported currently.
    var docLookup = doc, foundParen;
    function pickFunc(func, offset) {
      var strLen = func.length, padString = ' '.repeat(strLen);
      colorSelections.push(new Selection(getPosition(offset), getPosition(offset + strLen)));
      doc = doc.substring(0, offset) + padString + doc.substr(offset + strLen);
      return padString;
    }
    function hideParen(paren) {
      foundParen = true;
      return ' '.repeat(paren.length);
    }
    do {
      foundParen = false;
      docLookup = docLookup.replace(RE_CSS_FUNC, pickFunc).replace(RE_SINGLE_PAREN, hideParen);
    } while (foundParen);
  })();
  // require('fs').writeFileSync(
  //   require('path').join(__dirname, '../../rangeViewer/colorSelection.json'),
  //   JSON.stringify({doc: textEditor.document.getText(), ranges: colorSelection}));
  return colorSelections;
}

function getExSelection(selections, selection) {
  return selections.every(inSelection => {
    if (selection.isEmpty && inSelection.isEmpty) {
      // Accepts different points.
      return !selection.start.isEqual(inSelection.start);
    } else if (selection.isEmpty !== inSelection.isEmpty) {
      // Accepts area and point that is contiguous or far.
      return selection.start.isAfterOrEqual(inSelection.end) ||
        selection.end.isBeforeOrEqual(inSelection.start);
    } else {
      // Accepts excluded area.
      if (inSelection.contains(selection)) { return false; }
      if (selection.start.isAfterOrEqual(inSelection.end) ||
        selection.end.isBeforeOrEqual(inSelection.start)) { return true; }

      if (selection.start.isAfterOrEqual(inSelection.start)) { // foot
        selection = new Selection(inSelection.end, selection.end);
        return true;
      } else if (selection.end.isBeforeOrEqual(inSelection.end)) { // head
        selection = new Selection(selection.start, inSelection.start);
        return true;
      }
      return false; // area is split
    }
  }) ? selection : null;
}

// Since `window.show*Message` can't be hidden, use StatusBarMessage instead of it.
function showMessage(message) {
  var isOff;
  clearTimeout(messageTimer);
  if (uiMessage) {
    uiMessage.dispose();
    uiMessage = null;
    isOff = true;
  }

  if (message) {
    uiMessageText = message;
    isOff = false;
  } else if (message === false) {
    return;
  }

  if (isOff) {
    messageTimer = setTimeout(showMessage, MSG_BLINK_TIME_OFF);
  } else {
    uiMessage = vscode.window.setStatusBarMessage(uiMessageText);
    messageTimer = setTimeout(showMessage, MSG_BLINK_TIME_ON);
  }
}

exports.pick = () => {
  var textEditor, orgSelections, selections, colorSelections, orgColor = '', config;

  function procReplace(replacement) {
    var selectionsIndex = selections.map((v, i) => i);

    function editReplace() {
      var selection = selections[selectionsIndex.shift()],
        promise = textEditor.edit(edit => { edit.replace(selection, replacement); });
      promise.then(selectionsIndex.length ? editReplace : () => {
        textEditor.selections = textEditor.selections.map( // Unselect again
          selection => new Selection(selection.end, selection.end));
      });
    }

    if (selectionsIndex.length) {
      textEditor.selections = selections.map( // Unselect before edit
        selection => new Selection(selection.end, selection.end));
      selectionsIndex.sort( // bottom to top
        (a, b) => selections[b].start.compareTo(selections[a].start));
      editReplace();
    }
  }

  if (!(textEditor = vscode.window.activeTextEditor)) {
    console.warn('Cannot execute ' + COMMAND_ID + ' because there is no active text editor.');
    return;
  }

  orgSelections = textEditor.selections.slice();
  colorSelections = getColorSelections(textEditor);
  selections = orgSelections.reduce((selections, selection) => {
    var exSelection,
      colorSelection = colorSelections.find(colorSelection => {
        var exSelection;
        return selections.indexOf(colorSelection) < 0 && colorSelection.contains(selection) &&
          (exSelection = getExSelection(selections, colorSelection)) &&
          exSelection.isEqual(colorSelection);
      });
    if (colorSelection) {
      selections.push(colorSelection);
      if (!orgColor) {
        orgColor = textEditor.document.getText(colorSelection)
                                        // Not `\s{2,}`, to catch \r, \n and \t.
          .replace(RE_CSS_COMMENT, '').replace(/\s+/g, ' ');
      }
    } else if ((exSelection = getExSelection(selections, selection))) {
      selections.push(exSelection);
    }
    return selections;
  }, []);
  textEditor.selections = selections;
  // require('fs').writeFileSync(
  //   require('path').join(__dirname, '../../rangeViewer/selections.json'),
  //   JSON.stringify({doc: textEditor.document.getText(), ranges: selections}));

  if (!processBridge) {
    processBridge = require('process-bridge');
    delete process.env.ELECTRON_RUN_AS_NODE;
    delete process.env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
    process.env.ELECTRON_NO_ATTACH_CONSOLE = true;
  }
  config = vscode.workspace.getConfiguration('colorHelper');
  processBridge.sendRequest({
    value: orgColor,
    form: config.get('pickerForm'),
    storeDir: config.get('storeDir')
  }, ARGS, (error, message) => {
    showMessage(false);
    if (error) {
      if (error.isRetried) {
        console.warn('Retry (' + error + ')');
        showMessage('$(watch)\tPlease wait a while for setting up the extension...');
        return;
      }
      textEditor.selections = orgSelections;
      throw error;
    }

    if (message.value) {
      procReplace(message.value);
    } else {
      textEditor.selections = orgSelections;
    }
    if (!config.get('resident')) {
      processBridge.closeHost();
    }
  }, () => { showMessage(false); });
};

exports.deactivate = () => {
  if (processBridge) { processBridge.closeHost(); }
};

// Bug https://github.com/Microsoft/vscode/issues/3128
console.info = console.log;
