'use strict';

const
  vscode = require('vscode'),
  packageInfo = require('./package'),
  main = require(packageInfo.extensionMain);

exports.activate = context => {
  packageInfo.contributes.commands.forEach(commandReg => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        commandReg.command, main[commandReg.command.split('.').slice(-1)]));
  });
};

exports.deactivate = () => { if (main.deactivate) { main.deactivate(); } };
