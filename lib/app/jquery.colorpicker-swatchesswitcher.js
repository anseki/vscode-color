/* eslint-env browser, jquery */
/* eslint strict: [2, "function"] */

;jQuery($ => { // eslint-disable-line no-extra-semi
  'use strict';

  const paletteLoader = require('./palette-loader.js'); // path from ui.html

  $.colorpicker.parts.swatchesswitcher = function(inst) {
    this.init = () => {
      var $select = $('<select>'), list;

      paletteLoader.init(
        inst.options.part.swatchesswitcher.storeDir,
        inst.options.part.swatchesswitcher.parser,
        inst.options.part.swatchesswitcher.defaultPalette,
        inst.options.part.swatchesswitcher.defaultPaletteLabel);

      (list = paletteLoader.getList()).forEach(palette => {
        $select.append($(`<option value="${palette.fileName}"/>`).text(palette.label));
      });
      $select.change(() => {
        $.colorpicker.swatches._ = paletteLoader.getPalette($select.val());
        inst.option('swatches', '_');
      });

      $('.ui-colorpicker-swatchesswitcher-container', inst.dialog).append(
        $('<div class="ui-colorpicker-swatchesswitcher"/>').append($select));

      // Pass getter: palette
      if (inst.options.part.swatchesswitcher.bindPaletteGetter) {
        inst.options.part.swatchesswitcher.bindPaletteGetter(() => {
          return $select.val();
        });
      }
      // Pass setter: palette
      if (inst.options.part.swatchesswitcher.bindPaletteSetter) {
        inst.options.part.swatchesswitcher.bindPaletteSetter(fileName => {
          // Must call `.change()` to initialize with default palette even if `fileName` is invalid.
          $select.val(
            list.findIndex(palette => palette.fileName === fileName) > -1 ? fileName : '').change();
        });
      }
    };
  };
});
