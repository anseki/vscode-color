
'use strict';

const
  electron = require('electron'),
  app = electron.app,
  BrowserWindow = electron.BrowserWindow,
  ipc = electron.ipcMain,
  processBridge = require('process-bridge'),

  HTML_URL = 'file://' + __dirname + '/ui.html'; // eslint-disable-line no-path-concat

var ui, uiShown, request = {};

function closeUi(resValue) {
  if (!uiShown) { return; }
  // ui.hide();
  ui.minimize(); // The hidden window does not get focus properly.
  uiShown = false;
  request.cb(resValue);
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
      show: false,
      resizable: false,
      skipTaskbar: true,
      title: 'Color Picker',
      frame: false,
      transparent: true
    });

    ui.on('closed', () => {
      uiShown = false;
      ui = null;
    });

    ui.on('blur', () => {
      setTimeout(closeUi, 0);
    });

    ui.webContents.loadURL(HTML_URL + '?' + ui.id);
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
  ipc.on('close-ui', (event, resValue) => {
    closeUi(resValue);
  });

  ipc.on('finished', () => {
    app.quit();
  });

  processBridge.receiveRequest((message, cbResponse) => {
    request = message;
    request.cb = value => {
      cbResponse({value: value != null ? (value + '').trim() : ''}); // eslint-disable-line eqeqeq
    };
    openUi(message);
    // ui.webContents.openDevTools();
  }, () => {
    // Use `finish` to wait for closing task, `ui.close()` doesn't.
    ui.webContents.send('finish');
  });
});
