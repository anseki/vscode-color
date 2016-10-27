/* eslint-env browser */
/* eslint strict: [2, "function"] */

window.addEventListener('load', () => {
  'use strict';

  const
    electron = require('electron'),
    ipc = electron.ipcRenderer,
    uiController = require('./ui-controller.js'),
    common = require('../common.js');

  var ui = electron.remote.getCurrentWindow(),
    initOptions, onAfterReady;

  function resizeWindow(width, height, x, y) {
    var isMinimized;
    if (typeof x !== 'number' || typeof y !== 'number' ||
        !(electron.screen.getAllDisplays().some(display => { // find display
          var workArea = display.workArea,
            workAreaRight = workArea.x + workArea.width,
            workAreaBottom = workArea.y + workArea.height;
          if (x >= workArea.x && x < workAreaRight && y >= workArea.y && y < workAreaBottom) {
            let maxX = workAreaRight - width, maxY = workAreaBottom - height;
            x = x < workArea.x ? workArea.x : x > maxX ? maxX : x;
            y = y < workArea.y ? workArea.y : y > maxY ? maxY : y;
            return true;
          }
          return false;
        }))) { // center of primary display
      let workArea = electron.screen.getPrimaryDisplay().workArea;
      x = workArea.x + workArea.width / 2 - width / 2;
      y = workArea.y + workArea.height / 2 - height / 2;
    }
    if ((isMinimized = ui.isMinimized())) { ui.restore(); } // to make setBounds() work.
    ui.setBounds({x: Math.round(x), y: Math.round(y),
      width: Math.round(width), height: Math.round(height)});
    if (isMinimized) { ui.minimize(); }
  }

  function initUi() {
    initOptions.resizeWindow = resizeWindow;
    initOptions.commit = value => {
      var stats = uiController.getStats(),
        position = ui.getPosition();
      stats.x = position[0];
      stats.y = position[1];
      stats.formatsOrder = initOptions.stats.formatsOrder; // copy
      if (!value) { // Don't update when cancel button was clicked.
        stats.value = initOptions.value || initOptions.stats.value;
      } else if (stats.format) { // Update formatsOrder
        if (!stats.formatsOrder) { stats.formatsOrder = []; }
        common.hoistFormatsOrder(stats.formatsOrder, stats.format);
      }
      initOptions.stats = stats;
      ipc.send('close-ui', JSON.stringify({
        command: 'pick',
        value: value != null ? (value + '').trim() : ''
      }));
    };

    if (initOptions.command === 'pick') {
      uiController.init(initOptions);
      onAfterReady = null;
    } else { // convert
      let convert = uiController.init(initOptions);
      onAfterReady = () => {
        // Update formatsOrder
        if (!initOptions.stats.formatsOrder) { initOptions.stats.formatsOrder = []; }
        common.hoistFormatsOrder(initOptions.stats.formatsOrder, initOptions.formatId);

        ipc.send('close-ui', JSON.stringify({
          command: 'convert',
          value: initOptions.value.map(value => convert(value, initOptions.formatId))
        }));
      };
    }
  }

  // window.on('close') is not completed sometimes.
  // Maybe, the process is exited before big size DOM contents is removed.
  ipc.on('finish', () => {
    common.saveStats(initOptions.stats);
    ipc.send('finished'); // ui.webContents.sendSync() is not supported.
  });
  window.addEventListener('contextmenu', event => { event.preventDefault(); }, false);

  ipc.on('set-init-options', (event, newInitOptions) => {
    var stats = initOptions.stats;
    initOptions = JSON.parse(newInitOptions);
    initOptions.stats = stats;
    initOptions.formatsOrder = common.getFormatsOrder(initOptions.formatsOrder, stats.formatsOrder);
    initUi();
    ipc.send('ui-ready'); // ui.webContents.sendSync() is not supported.
    if (onAfterReady) { onAfterReady(); }
  });

  initOptions = JSON.parse(ipc.sendSync('get-init-options'));
  initOptions.stats = common.loadStats() || {};
  initOptions.formatsOrder = common.getFormatsOrder(initOptions.formatsOrder, initOptions.stats.formatsOrder);
  initUi();
  ipc.send('ui-ready');
  if (onAfterReady) { onAfterReady(); }
}, false);
