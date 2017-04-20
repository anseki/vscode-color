
'use strict';

const
  electron = require('electron'),
  app = electron.app,
  BrowserWindow = electron.BrowserWindow,
  ipc = electron.ipcMain,
  processBridge = require('process-bridge'),

  HTML_URL = 'file://' + __dirname + '/ui.html'; // eslint-disable-line no-path-concat

let ui, uiShown, request = {};

function closeUi(message) {
  if (!uiShown) { return; }
  // ui.hide();
  ui.minimize(); // The hidden window does not get focus properly.
  uiShown = false;
  request.cb(message);
}

function openUi(initOptions) {
  if (ui) {
    ui.webContents.send('set-init-options', JSON.stringify(initOptions));
    ipc.once('ui-ready', () => {
      if (!uiShown) {
        ui.show();
        uiShown = true;
      }
    });
  } else {
    electron.Menu.setApplicationMenu(null); // Do this before new BrowserWindow() for sizing.
    ui = new BrowserWindow({
      useContentSize: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      title: 'Color Picker',
      show: false,
      frame: false,
      transparent: !initOptions.disableTransparent
    });
    ui.webContents.openDevTools(); // [DEBUG/]

    ui.on('closed', () => {
      uiShown = false;
      ui = null;
    });

    /* [DEBUG/]
    ui.on('blur', () => {
      setTimeout(closeUi, 0);
    });
    [DEBUG/] */

    ui.webContents.loadURL(HTML_URL);
    ipc.once('get-init-options', event => {
      event.returnValue = JSON.stringify(initOptions);
    });
    ipc.once('ui-ready', () => {
      ui.show();
      uiShown = true;
    });
  }
}

app.on('ready', () => {
  ipc.on('close-ui', (event, message) => {
    closeUi(JSON.parse(message));
  });

  ipc.on('finished', () => {
    app.quit();
  });

  processBridge.receiveRequest((message, cbResponse) => {
    // Check valid options
    message.disableShadow =
      (message.disableTransparent = !!message.disableTransparent) ? true : !!message.disableShadow;

    request = message;
    request.cb = message => { cbResponse(message || {}); };
    openUi(message);
  }, () => {
    // Use `finish` to wait for closing task, `ui.close()` doesn't.
    ui.webContents.send('finish');
  });
});
