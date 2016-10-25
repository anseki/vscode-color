/* eslint-env browser, jquery */
/* eslint strict: [2, "function"] */
/* eslint no-underscore-dangle: [2, {"allow": ["_getRegional", "_change"]}] */

;jQuery($ => { // eslint-disable-line no-extra-semi
  'use strict';

  const CLASS_PREFIX_FORMATS = 'ui-colorpicker-formats',
    CLASS_PREFIX_FORMATSFOOTER = 'ui-colorpicker-formatsfooter';
  var curText, //  {$input: <$element>, value: <text>}
    $okButton;

  function escapeHtml(text) {
    return (text || '')
      .replace(/\&/g, '&amp;')
      .replace(/\'/g, '&#x27;')
      .replace(/\`/g, '&#x60;')
      .replace(/\"/g, '&quot;')
      .replace(/\</g, '&lt;')
      .replace(/\>/g, '&gt;');
  }

  function curTextInputVal(value) {
    var normalValue;
    function normalizeValue(value) {
      return value != null ? (value + '').trim() : '';
    }
    if (arguments.length) {
      curText.$input.val((normalValue = normalizeValue(value)));
    } else {
      normalValue = normalizeValue((value = curText.$input.val()));
    }
    $okButton.button(normalValue !== '' ? 'enable' : 'disable');
    return value;
  }

  $.colorpicker.parts.formats = function(inst) {
    var curFormat,        //  {$input: <$element>, value: <formatId>}
      curOptions = {},    /*  {
                                <formatId>: {
                                  $options: <$element>,
                                  <optionId>: {
                                    $input: <$element>,
                                    value: <boolean or any>,
                                    type: <'checkbox'(default) or 'select' or 'radio'(Not yet)>
                                  }
                                }
                              } */
      formatsConfHash = {}, //  {<formatId>: formatConf}
      cancelUpdateTextOnce;

    function formatChangeEffect(oldFormatId, newFormatId) {
      var formatConf;
      if (curOptions[oldFormatId]) {
        curOptions[oldFormatId].$options.removeClass('state-active');
      }
      if (curOptions[newFormatId]) {
        curOptions[newFormatId].$options.addClass('state-active');
      }
      curFormat.$input.attr('title',
        (formatConf = formatsConfHash[newFormatId]) && formatConf.description ?
          formatConf.description : '');
    }

    // newOptions: {<formatId>: {<optionId>: {value: <boolean or any>}}}
    function updateFormWithOptions(newFormatId, newOptions) {
      if (formatsConfHash[newFormatId] && newFormatId !== curFormat.value) {
        curFormat.$input.val(newFormatId);
        formatChangeEffect(curFormat.value, newFormatId);
        curFormat.value = newFormatId;
      }

      if (newOptions) {
        Object.keys(newOptions).forEach(formatId => {
          var formatOptions;
          if (!curOptions.hasOwnProperty(formatId)) { return; }
          formatOptions = curOptions[formatId];
          Object.keys(newOptions[formatId]).forEach(optionId => {
            var option, newOptionValue;
            if (!formatOptions.hasOwnProperty(optionId)) { return; }
            option = formatOptions[optionId];
            newOptionValue = newOptions[formatId][optionId].value;
            if (newOptionValue !== option.value) {
              if (option.type === 'checkbox') {
                option.$input.prop('checked', (option.value = !!newOptionValue));
              } else if (option.type === 'select') {
                if (option.values.indexOf(newOptionValue) > -1) {
                  option.$input.val((option.value = newOptionValue));
                }
              }
            }
          });
        });
      }

      return {format: curFormat, options: curOptions};
    }

    function updateText() {
      var newValue;
      if (!cancelUpdateTextOnce &&
          (newValue = formatsConfHash[curFormat.value].generate(inst.color, curOptions))
            !== curText.value) {
        curTextInputVal((curText.value = newValue));
      }
      cancelUpdateTextOnce = false;
    }

    function formatChange() {
      var newFormatValue = curFormat.$input.val();
      if (newFormatValue !== curFormat.value) {
        formatChangeEffect(curFormat.value, newFormatValue);
        curFormat.value = newFormatValue;
        updateText();
      }
    }

    function optionChange(event) {
      var option = event.data.option,
        newOptionValue =
          option.type === 'checkbox' ? option.$input.prop('checked') :
          option.type === 'select' ? option.$input.val() :
          option.value;
      if (newOptionValue !== option.value) {
        option.value = newOptionValue;
        updateText();
      }
    }

    function textChanged(event, initPreview) {
      var newValue = curTextInputVal(), parsedArgs, changeEvent;
      if ((event && (changeEvent = event.type === 'change') || newValue !== curText.value) &&
          (parsedArgs = inst.options.part.formats.parser((curText.value = newValue), inst.color))) {
        updateFormWithOptions(parsedArgs.formatId, parsedArgs.options);
        if (changeEvent && parsedArgs.normalizedText !== newValue) {
          curTextInputVal((curText.value = parsedArgs.normalizedText));
        }
        if (initPreview) { inst.currentColor	= inst.color.copy(); }
        cancelUpdateTextOnce = true;
        inst._change();
      }
    }

    function setText(text, initPreview) {
      if (typeof text === 'string' && (text = text.trim()) !== '') {
        curText.$input.val(text).triggerHandler('change', [initPreview]);
      }
      curText.$input.focus().select();
    }

    this.init = () => {
      var $frame = $(`<div class="${CLASS_PREFIX_FORMATS}-frame"/>`)
        .css({height: '50px', overflow: 'hidden'}), maxHeight = 0, 	guides = [];
      curFormat = {
        $input: $('<select/>').change(formatChange),
        value: inst.options.formatsConf[0].id
      };

      inst.options.formatsConf.forEach(formatConf => {
        formatsConfHash[formatConf.id] = formatConf;

        curFormat.$input.append(
          $(`<option title="${escapeHtml(formatConf.description)}"` +
            ` value="${formatConf.id}"${formatConf.default ? ' selected' : ''}>` +
            `${escapeHtml(formatConf.label)}</option>`));
        if (formatConf.default) { curFormat.value = formatConf.id; }

        if (formatConf.options) {
          let options = curOptions[formatConf.id] = {$options:
            $(`<div class="${CLASS_PREFIX_FORMATS}-options state-active"/>`).appendTo($frame)};
          formatConf.options.forEach(optionConf => {
            var option = options[optionConf.id] = {type: optionConf.type || 'checkbox'}, insertPre;

            if (option.type === 'checkbox') {
              option.value = !!optionConf.default;
              option.$input = $(`<input type="checkbox"${option.value ? ' checked' : ''}>`);
              insertPre = true;

            } else if (option.type === 'select') {
              let values = [];
              option.value = optionConf.default;
              option.$input = $('<select>' + optionConf.values.map(selectOption => {
                var value, label;
                if (typeof selectOption === 'string' || typeof selectOption === 'number') {
                  value = label = selectOption;
                } else {
                  value = selectOption.value;
                  label = selectOption.label;
                }
                values.push(value + '');
                if (typeof option.value === 'undefined') { option.value = value; }
                return `<option value="${value}"${value === option.value ? ' selected' : ''}>` +
                  `${label}</option>`;
              }).join('') + '</select>');
              option.values = values;

            }

            $(`<label title="${escapeHtml(optionConf.description)}">` +
                `${escapeHtml(optionConf.label)}</label>`)[insertPre ? 'prepend' : 'append'](
                option.$input.change({option: option}, optionChange)
              ).appendTo(options.$options);
          });
        }
        if (formatConf.guide) { guides = guides.concat(formatConf.guide); }
      });

      curText = {
        $input: $(`<input type="text" class="${CLASS_PREFIX_FORMATS}-text">`)
          .on('change keyup', textChanged),
        value: ''
      };

      $(`<div class="${CLASS_PREFIX_FORMATS} ui-corner-all"/>`).append(
        curFormat.$input, $frame, curText.$input
      ).appendTo($(`.${CLASS_PREFIX_FORMATS}-container`, inst.dialog));

      if (guides.length) {
        curText.$input.after(
          `<datalist id="${CLASS_PREFIX_FORMATS}-guide">` +
          guides.map(guide => `<option value="${guide}">`).join('') +
          '</datalist>')
        .attr('list', `${CLASS_PREFIX_FORMATS}-guide`)
        .datalist(); // Polyfill
      }

      // Adjust height after rendering.
      Object.keys(curOptions).forEach(formatId => {
        var $options = curOptions[formatId].$options, height = $options.outerHeight();
        if (height > maxHeight) { maxHeight = height; }
        $options.removeClass('state-active');
      });
      $frame.css({height: maxHeight ? `${maxHeight}px` : '', overflow: ''});
      formatChangeEffect(null, curFormat.value);

      // Pass getter: curText.value
      if (inst.options.part.formats.bindValueGetter) {
        inst.options.part.formats.bindValueGetter(() => {
          return curText.value;
        });
      }
      // Pass setter: curText.value
      if (inst.options.part.formats.bindValueSetter) {
        inst.options.part.formats.bindValueSetter(setText);
      }
      // Pass getter: curText.$input
      if (inst.options.part.formats.bindInputGetter) { // for Polyfill
        inst.options.part.formats.bindInputGetter(() => {
          return curText.$input;
        });
      }
      // Pass getter: formats (includes: curFormat, curOptions, mode)
      if (inst.options.part.formats.bindFormatsGetter) {
        inst.options.part.formats.bindFormatsGetter(() => {
          curText.$input.change(); // normalize
          return {
            format: curFormat.value,
            // flatOptions: {<formatId>: {<optionId>: <boolean or any>}}
            options: Object.keys(curOptions).reduce((flatOptions, formatId) => {
              var formatOptions = curOptions[formatId];
              flatOptions[formatId] =
                Object.keys(formatOptions).reduce((flatFormatOptions, optionId) => {
                  if (optionId !== '$options') {
                    flatFormatOptions[optionId] = formatOptions[optionId].value;
                  }
                  return flatFormatOptions;
                }, {});
              return flatOptions;
            }, {}),
            mode: inst.mode
          };
        });
      }
      // Pass setter: formats (includes: curFormat, curOptions, mode)
      if (inst.options.part.formats.bindFormatsSetter) {
        inst.options.part.formats.bindFormatsSetter(formats => {
          var newOptions;
          if (formats.options) {
            // formats.options (flatOptions): {<formatId>: {<optionId>: <boolean or any>}}
            // newOptions: {<formatId>: {<optionId>: {value: <boolean or any>}}}
            // The validation checked by updateFormWithOptions().
            newOptions = Object.keys(formats.options).reduce((options, formatId) => {
              var flatFormatOptions = formats.options[formatId];
              options[formatId] =
                Object.keys(flatFormatOptions).reduce((formatOptions, optionId) => {
                  formatOptions[optionId] = {value: flatFormatOptions[optionId]};
                  return formatOptions;
                }, {});
              return options;
            }, {});
          }
          updateFormWithOptions(formats.format, newOptions);
          if (formats.mode) {
            $(`input.ui-colorpicker-mode[value="${formats.mode}"]`, inst.dialog).click();
          }
        });
      }
      // Pass getter: curOptions
      if (inst.options.part.formats.bindCurOptionsGetter) {
        inst.options.part.formats.bindCurOptionsGetter(() => {
          return curOptions;
        });
      }
      // Pass re-order formats
      if (inst.options.part.formats.bindFormatsOrder) {
        inst.options.part.formats.bindFormatsOrder(order => {
          var i;
          for (i = order.length - 1; i >= 0; i--) {
            curFormat.$input.children(`option[value="${order[i]}"]`).prependTo(curFormat.$input);
          }
        });
      }
    };

    this.repaint = this.update = updateText;
  };

  $.colorpicker.parts.formatsfooter = function(inst) {
    var $cancelButton;
    function keyup(event) { // eslint-disable-line consistent-return
      if (event.keyCode === 13) { // Enter key
        $okButton.click();
        return false;
      }
    }
    function keydown(event) { // eslint-disable-line consistent-return
      if (event.keyCode === 27) { // Escape key
        $cancelButton.click();
        return false;
      }
    }

    this.init = () => {
      $(`<div class="${CLASS_PREFIX_FORMATSFOOTER}"/>`).append(
        ($okButton = $(`<button>${inst._getRegional('ok')}</button>`)).button().click(() => {
          if (inst.options.part.formats.ok) { inst.options.part.formats.ok(curTextInputVal()); }
        }),
        ($cancelButton = $(`<button>${inst._getRegional('cancel')}</button>`)).button().click(() => {
          if (inst.options.part.formats.cancel) { inst.options.part.formats.cancel(); }
        })
      ).appendTo($(`.${CLASS_PREFIX_FORMATSFOOTER}-container`, inst.dialog));

      $(document).keyup(keyup).keydown(keydown);
    };

    this.repaint = () => { curTextInputVal(); };
    this.update = () => {};
    this.destroy = () => {
      $(document).off('keyup', keyup).off('keydown', keydown);
    };
  };
});
