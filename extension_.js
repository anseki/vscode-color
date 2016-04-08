'use strict';

const
  vscode = require('vscode'),
  packageInfo = require('./package'),
  main = require(packageInfo.extensionMain);

// [postinstall]

// Since `scripts.postinstall` of `package.json` is not supported, simulate it.

try {
  null(); // [DEBUG/] Skip this block by making an error occur.
  let fs = require('fs'), pathUtil = require('path');
  fs.renameSync(
    pathUtil.join(__dirname, 'lib/app.asar_'),
    pathUtil.join(__dirname, 'lib/app.asar'));

  fs.writeFileSync(__filename,
    fs.readFileSync(__filename, {encoding: 'utf8'})
      .replace(/\/\/[^\n]*?\[postinstall\][\s\S]*?\/\/[^\n]*?\[\/postinstall\][^\n]*\n\s*/, ''));
} catch (error) { /* ignore */ }

// [/postinstall]

exports.activate = context => {
  packageInfo.contributes.commands.forEach(commandReg => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        commandReg.command, main[commandReg.command.split('.').slice(-1)]));
  });
};

exports.deactivate = () => { if (main.deactivate) { main.deactivate(); } };
