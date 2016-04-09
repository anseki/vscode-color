/* eslint-env browser */
/* eslint strict: [2, "function"] */

window.addEventListener('load', () => {
  'use strict';

  const
    electron = require('electron'),
    ipc = electron.ipcRenderer,
    uiController = require('./ui-controller.js'),

    // __filename: '/path/to/extension_root/lib/app.asar/self.js'
    STATS_PATH = require('path').join(__dirname, '../../stats.json');

  var ui = electron.remote.getCurrentWindow(),
    initOptions, onLoaded;

  function resizeWindow(width, height, x, y) {
    var workArea = electron.screen.getPrimaryDisplay().workArea, isMinimized;
    if (typeof x === 'number' && typeof y === 'number') {
      let maxX = workArea.x + workArea.width - width,
        maxY = workArea.y + workArea.height - height;
      x = x < workArea.x ? workArea.x : x > maxX ? maxX : x;
      y = y < workArea.y ? workArea.y : y > maxY ? maxY : y;
    } else { // center
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
      // Don't update when cancel button was clicked.
      if (!value) { stats.value = initOptions.value || initOptions.stats.value; }
      initOptions.stats = stats;
      ipc.send('close-ui', JSON.stringify({
        command: 'pick',
        value: value != null ? (value + '').trim() : '' // eslint-disable-line eqeqeq
      }));
    };

    if (initOptions.command === 'pick') {
      uiController.init(initOptions);
      onLoaded = null;
    } else { // convert
      let convert = uiController.init(initOptions);
      onLoaded = () => {
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
    try {
      require('fs').writeFileSync(STATS_PATH, JSON.stringify(initOptions.stats));
    } catch (error) { /* ignore */ }
    ipc.send('finished'); // ui.webContents.sendSync() is not supported.
  });
  window.addEventListener('contextmenu', event => { event.preventDefault(); }, false);

  ipc.on('set-init-options', (event, newInitOptions) => {
    var stats = initOptions.stats;
    initOptions = JSON.parse(newInitOptions);
    initOptions.stats = stats;
    initUi();
    ipc.send('ui-ready'); // ui.webContents.sendSync() is not supported.
    if (onLoaded) { onLoaded(); }
  });

  initOptions = JSON.parse(ipc.sendSync('get-init-options'));
  initOptions.stats = {};
  try {
    initOptions.stats = require(STATS_PATH);
  } catch (error) { /* ignore */ }
  initUi();
  ipc.send('ui-ready');
  if (onLoaded) { onLoaded(); }
}, false);
