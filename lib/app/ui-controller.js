/* eslint-env browser,jquery */

'use strict';

const
  CSS_COLORS_WITH_DATA =
    require('../css-colors.json').filter(color => typeof color.r === 'number'),
  FORMATS_NAME = require('../formats-name.json'),
  $ = window.jQuery;
var $colorpicker, remakeOptions = {},
  getValue, setValue, getFormats, setFormats, getPalette, setPalette, getInput, convert;

function createUi(initOptions) {

  function fixNum(num, min, max, digits) {
    var exp;
    if (typeof min === 'number' && num < min) { return min; }
    if (typeof max === 'number' && num > max) { return max; }
    if (!/\./.test(num + '')) { return num; }
    if (typeof digits !== 'number') { digits = 3; }
    exp = Math.pow(10, digits);
    return Math.round(num * exp) / exp;
  }

  const
    // Copy from ui.scss
    BODY_PADDING_CLEARANCE = 5,
    BODY_PADDING_TOP = 12 + BODY_PADDING_CLEARANCE,
    BODY_PADDING_RIGHT = 20 + BODY_PADDING_CLEARANCE,
    BODY_PADDING_BOTTOM = 22 + BODY_PADDING_CLEARANCE,
    BODY_PADDING_LEFT = 14 + BODY_PADDING_CLEARANCE,

    PTN_NUM = '\\-?\\d+(?:\\.\\d+)?',
    RE_NUM = new RegExp(`^(${PTN_NUM})$`),
    RE_PERCENT = new RegExp(`^(${PTN_NUM}) *\\%$`),
    FULL_CIRCLE = {deg: 360, grad: 400, rad: 2 * Math.PI, turn: 1},
    ANGLE_UNITS = Object.keys(FULL_CIRCLE),
    RE_ANGLE = new RegExp(`^(${PTN_NUM}) *(` +
      ANGLE_UNITS.map(unit => unit.replace(/[\x00-\x7f]/g,
        s => '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2))).join('|') + ')?$', 'i'),
    ANGLE_UNITS_OPTION = [{value: '', label: '(none)'}].concat(ANGLE_UNITS),
    RE_CSS_HEX = new RegExp('^#(?:' +
      '([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?|' +
      '([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?' +
      ')$', 'i');

  /**
   * @param {string} text - The text to be parsed. (e.g. 0100 grad)
   * @returns {Object|null} parsedArg
   * @returns {string} parsedArg.normalizedText - The normalized text. (e.g. 100grad)
   * @returns {number} parsedArg.num01 - The number in the range [0, 1] based "deg". (e.g. 0.25)
   * @returns {string} parsedArg.unit - The string expressing a unit. (e.g. grad)
   * @returns {number} parsedArg.deg - The number as deg. (e.g. 90)
   */
  function parseAngle(text) {
    var matches, num, unit, lenFullCircle, numDeg;
    if (!(matches = text.match(RE_ANGLE))) { return null; }
    num = Number(matches[1]) || 0; // avoid `-0`
    unit = (matches[2] || '').toLowerCase();
    lenFullCircle = FULL_CIRCLE[unit || 'deg'];

    if (num > lenFullCircle) {
      num = num % lenFullCircle;
    } else {
      while (num < 0) { num += lenFullCircle; }
    }
    numDeg = fixNum(unit && unit !== 'deg' ? num / lenFullCircle * FULL_CIRCLE.deg : num,
      0, FULL_CIRCLE.deg);
    return {
      normalizedText: (unit && unit !== 'deg' ? fixNum(num, 0, lenFullCircle) : numDeg) + unit,
      num01: fixNum(numDeg / 360, 0, 1),
      unit: unit,
      deg: numDeg
    };
  }

  /**
   * @param {string} text - The text to be parsed. (e.g. 050 %)
   * @returns {Object|null} parsedArg
   * @returns {string} parsedArg.normalizedText - The normalized text. (e.g. 50%)
   * @returns {number} parsedArg.num01 - The number in the range [0, 1]. (e.g. 0.5)
   */
  function parsePercent(text) {
    var matches, num;
    if (!(matches = text.match(RE_PERCENT))) { return null; }
    num = fixNum((Number(matches[1]) || 0 /* avoid `-0` */), 0, 100);
    return {
      normalizedText: `${num}%`,
      num01: fixNum(num / 100, 0, 1, 5)
    };
  }

  /**
   * @param {string} text - The text to be parsed. (e.g. 00.80)
   * @returns {Object|null} parsedArg
   * @returns {string} parsedArg.normalizedText - The normalized text. (e.g. 0.8)
   * @returns {number} parsedArg.num01 - The number in the range [0, 1]. (e.g. 0.8)
   * @returns {string} parsedArg.percent - The number as the percent. (e.g. 80%)
   */
  function parsePercent01(text) {
    var matches, num01;
    if (!(matches = text.match(RE_NUM))) { return null; }
    num01 = fixNum((Number(matches[1]) || 0 /* avoid `-0` */), 0, 1, 5);
    return {
      normalizedText: num01 + '',
      num01: num01,
      percent: fixNum(num01 * 100, 0, 100) + '%'
    };
  }

  /**
   * @param {string} text - The text to be parsed. (e.g. 00127)
   * @returns {Object|null} parsedArg
   * @returns {string} parsedArg.normalizedText - The normalized text. (e.g. 127)
   * @returns {number} parsedArg.num01 - The number in the range [0, 1]. (e.g. 0.49804)
   * @returns {string} parsedArg.percent - The number as the percent. (e.g. 49.804%)
   */
  function parse255(text) {
    var matches, num, num01;
    if (!(matches = text.match(RE_NUM))) { return null; }
    num = fixNum((Number(matches[1]) || 0 /* avoid `-0` */), 0, 255);
    num01 = fixNum(num / 255, 0, 1, 5);
    return {
      normalizedText: num + '',
      num01: num01,
      percent: fixNum(num01 * 100, 0, 100) + '%'
    };
  }

  /**
   * @param {number} num01 - The number in the range [0, 1]. (e.g. 0.25)
   * @param {string} [unit=deg] - The string expressing a unit. (e.g. grad)
   * @returns {string} generatedText - The normalized text. (e.g. 100grad)
   */
  function generateAngle(num01, unit) {
    var lenFullCircle = FULL_CIRCLE[unit || 'deg'];
    return fixNum(num01 * lenFullCircle, 0, lenFullCircle, 1) + (unit || '');
  }

  /**
   * @param {number} num01 - The number in the range [0, 1]. (e.g. 0.8)
   * @returns {string} generatedText - The normalized text. (e.g. 80%)
   */
  function generatePercent(num01) {
    return fixNum(num01 * 100, 0, 100, 1) + '%';
  }

  /**
   * @param {number} num01 - The number in the range [0, 1]. (e.g. 0.8)
   * @returns {string} generatedText - The normalized text. (e.g. 0.8)
   */
  function generatePercent01(num01) {
    return fixNum(num01, 0, 1, 3) + '';
  }

  /**
   * @param {number} num01 - The number in the range [0, 1]. (e.g. 0.8)
   * @returns {string} generatedText - The normalized text. (e.g. 0.8)
   */
  function generate255(num01) {
    return fixNum(num01 * 255, 0, 255, 0) + '';
  }

  /**
   * HWB -> RGB
   * @param {Object} hwb - HWB color.
   * @returns {Object} rgb - RGB color.
   */
  function hwb2rgb(hwb) {
    var rgb;
    if (hwb.w + hwb.b > 1) {
      hwb.w = fixNum(hwb.w / (hwb.w + hwb.b) * 100, null, null, 0);
      hwb.b = 100 - hwb.w;
      hwb.w /= 100;
      hwb.b /= 100;
    }
    rgb = (new $.colorpicker.Color()).setHSL(hwb.h, 1, 0.5).getRGB();
    ['r', 'g', 'b'].forEach(channel => {
      rgb[channel] *= 1 - hwb.w - hwb.b;
      rgb[channel] = fixNum(rgb[channel] + hwb.w, 0, 1, 5);
    });
    return rgb;
  }

  var formatsConfHash, savedCmykF, savedCmykValues;
  const
    FORMATS_CONF = [
      /*
        `parse` function of format having `funcNames`:
            @param {Array} funcParts
            @param {$.colorpicker.Color} [color]
            @returns {Object|null} parsedColor
            @returns {string} parsedColor.formatId
            @returns {string} parsedColor.normalizedText
            @returns {Object} [parsedColor.options] - {<formatId>: {<optionId>: {value: <boolean or any>}}}

        `parse` function of format having no `funcNames`:
            @param {string} text
            @param {$.colorpicker.Color} [color]
            @returns {boolean} parsedColor - false: This notation is caught, but it has error (it's not another notation).
            @returns {null} parsedColor - null: `text` is not this notation (it might be another notation).
            @returns {Object} parsedColor
            @returns {string} parsedColor.formatId
            @returns {string} parsedColor.normalizedText
            @returns {Object} [parsedColor.options] - {<formatId>: {<optionId>: {value: <boolean or any>}}}

        `generate` function:
            @param {$.colorpicker.Color} color
            @param {Object} options - {<formatId>: {<optionId>: {value: <boolean or any>}}}
            @returns {string|null} normalizedText
      */
      {
        id: 'hsb',
        options: [
          {
            id: 'unitH',
            label: '<H>',
            description: `Unit of <H>. The value is handled as "deg" if "${ANGLE_UNITS_OPTION[0].label}" is specified.`,
            type: 'select',
            values: ANGLE_UNITS_OPTION,
            default: ''
          },
          {
            id: 'percentA',
            label: '<A>%',
            description: 'Expresses <A> as percentage.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. 100% or 1.0).'
          }
        ],
        funcNames: ['hsb', 'hsba'],

        parse: (funcParts, color) => {
          var funcName = 'hsb', options = {}, colorParams = {}, textArgs = [], arg;
          if (funcParts.length < 4) { return null; }
          // <H>
          if (!(arg = parseAngle(funcParts[1]))) { return null; }
          colorParams.h = arg.num01;
          textArgs.push(arg.normalizedText);
          options.unitH = {value: arg.unit};
          // <S>
          if (!(arg = parsePercent(funcParts[2]))) { return null; }
          colorParams.s = arg.num01;
          textArgs.push(arg.normalizedText);
          // <V>
          if (!(arg = parsePercent(funcParts[3]))) { return null; }
          colorParams.v = arg.num01;
          textArgs.push(arg.normalizedText);
          // <A>
          if (funcParts.length >= 5) {
            funcName = 'hsba';
            if ((arg = parsePercent(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: true};
            } else if ((arg = parsePercent01(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: false};
            }
          }

          if (color) {
            color.setHSV(colorParams.h, colorParams.s, colorParams.v)
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'hsb',
            normalizedText: `${funcName}(${textArgs.join(', ')})`,
            options: {hsb: options}
          };
        },

        generate: (color, options) => {
          var funcName = 'hsb', colorParams = color.getHSV(), textArgs = [];
          options = options.hsb;
          textArgs.push(generateAngle(colorParams.h, options.unitH.value),
            generatePercent(colorParams.s), generatePercent(colorParams.v));
          if ((colorParams = color.getAlpha()) < 1 || options.includeA.value) {
            funcName = 'hsba';
            textArgs.push(options.percentA.value ?
              generatePercent(colorParams) : generatePercent01(colorParams));
          }
          return `${funcName}(${textArgs.join(', ')})`;
        }
      },
      {
        id: 'hsl',
        options: [
          {
            id: 'unitH',
            label: '<H>',
            description: `Unit of <H>. The value is handled as "deg" if "${ANGLE_UNITS_OPTION[0].label}" is specified.\n\n**NOTE**: Some browsers don't support unit. (i.e. a number must be value of\n"deg".)`,
            type: 'select',
            values: ANGLE_UNITS_OPTION,
            default: ''
          },
          {
            id: 'percentA',
            label: '<A>%',
            description: 'Expresses <A> as percentage.\n\n**NOTE**: Some browsers don\'t support percentage expression.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. 100% or 1.0).'
          }
        ],
        funcNames: ['hsl', 'hsla'],

        parse: (funcParts, color) => {
          var funcName = 'hsl', options = {}, colorParams = {}, textArgs = [], arg;
          if (funcParts.length < 4) { return null; }
          // <H>
          if (!(arg = parseAngle(funcParts[1]))) { return null; }
          colorParams.h = arg.num01;
          textArgs.push(arg.normalizedText);
          options.unitH = {value: arg.unit};
          // <S>
          if (!(arg = parsePercent(funcParts[2]))) { return null; }
          colorParams.s = arg.num01;
          textArgs.push(arg.normalizedText);
          // <L>
          if (!(arg = parsePercent(funcParts[3]))) { return null; }
          colorParams.l = arg.num01;
          textArgs.push(arg.normalizedText);
          // <A>
          if (funcParts.length >= 5) {
            funcName = 'hsla';
            if ((arg = parsePercent(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: true};
            } else if ((arg = parsePercent01(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: false};
            }
          }

          if (color) {
            color.setHSL(colorParams.h, colorParams.s, colorParams.l)
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'hsl',
            normalizedText: `${funcName}(${textArgs.join(', ')})`,
            options: {hsl: options}
          };
        },

        generate: (color, options) => {
          var funcName = 'hsl', colorParams = color.getHSL(), textArgs = [];
          options = options.hsl;
          textArgs.push(generateAngle(colorParams.h, options.unitH.value),
            generatePercent(colorParams.s), generatePercent(colorParams.l));
          if ((colorParams = color.getAlpha()) < 1 || options.includeA.value) {
            funcName = 'hsla';
            textArgs.push(options.percentA.value ?
              generatePercent(colorParams) : generatePercent01(colorParams));
          }
          return `${funcName}(${textArgs.join(', ')})`;
        }
      },
      {
        id: 'hwb',
        options: [
          {
            id: 'unitH',
            label: '<H>',
            description: `Unit of <H>. The value is handled as "deg" if "${ANGLE_UNITS_OPTION[0].label}" is specified.`,
            type: 'select',
            values: ANGLE_UNITS_OPTION,
            default: ''
          },
          {
            id: 'percentA',
            label: '<A>%',
            description: 'Expresses <A> as percentage.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. 100% or 1.0).'
          }
        ],
        funcNames: ['hwb'],

        parse: (funcParts, color) => {
          var funcName = 'hwb', options = {}, colorParams = {}, textArgs = [], arg;
          if (funcParts.length < 4) { return null; }
          // <H>
          if (!(arg = parseAngle(funcParts[1]))) { return null; }
          colorParams.h = arg.num01;
          textArgs.push(arg.normalizedText);
          options.unitH = {value: arg.unit};
          // <W>
          if (!(arg = parsePercent(funcParts[2]))) { return null; }
          colorParams.w = arg.num01;
          textArgs.push(arg.normalizedText);
          // <B>
          if (!(arg = parsePercent(funcParts[3]))) { return null; }
          colorParams.b = arg.num01;
          textArgs.push(arg.normalizedText);
          // <A>
          if (funcParts.length >= 5) {
            if ((arg = parsePercent(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: true};
            } else if ((arg = parsePercent01(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: false};
            }
          }

          if (color) {
            color.setRGB(hwb2rgb(colorParams))
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'hwb',
            normalizedText: `${funcName}(${textArgs.join(', ')})`,
            options: {hwb: options}
          };
        },

        generate: (color, options) => {
          var funcName = 'hwb', colorParams = color.getHSV(), textArgs = [];
          options = options.hwb;
          // HSV -> HWB
          colorParams.w = (1 - colorParams.s) * colorParams.v;
          colorParams.b = 1 - colorParams.v;
          textArgs.push(generateAngle(colorParams.h, options.unitH.value),
            generatePercent(colorParams.w), generatePercent(colorParams.b));
          if ((colorParams = color.getAlpha()) < 1 || options.includeA.value) {
            textArgs.push(options.percentA.value ?
              generatePercent(colorParams) : generatePercent01(colorParams));
          }
          return `${funcName}(${textArgs.join(', ')})`;
        }
      },
      {
        id: 'rgb',
        default: true,
        options: [
          {
            id: 'percentRGB',
            label: '<RGB>%',
            description: 'Expresses <R>, <G>, and <B> as percentage.',
            default: true
          },
          {
            id: 'percentA',
            label: '<A>%',
            description: 'Expresses <A> as percentage.\n\n**NOTE**: Some browsers don\'t support percentage expression.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. 100% or 1.0).'
          }
        ],
        funcNames: ['rgb', 'rgba'],

        parse: (funcParts, color) => {
          var funcName = 'rgb', options = {}, colorParams = {}, textArgs = [], arg;
          if (funcParts.length < 4) { return null; }
          options.percentRGB = {value: false}; // Changed by one or more channel.
          // <R>
          if (!(arg = parse255(funcParts[1]))) {
            if (!(arg = parsePercent(funcParts[1]))) { return null; }
            options.percentRGB.value = true;
          }
          colorParams.r = arg.num01;
          textArgs.push(arg.normalizedText);
          // <G>
          if (!(arg = parse255(funcParts[2]))) {
            if (!(arg = parsePercent(funcParts[2]))) { return null; }
            options.percentRGB.value = true;
          }
          colorParams.g = arg.num01;
          textArgs.push(arg.normalizedText);
          // <B>
          if (!(arg = parse255(funcParts[3]))) {
            if (!(arg = parsePercent(funcParts[3]))) { return null; }
            options.percentRGB.value = true;
          }
          colorParams.b = arg.num01;
          textArgs.push(arg.normalizedText);
          // <A>
          if (funcParts.length >= 5) {
            funcName = 'rgba';
            if ((arg = parsePercent(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: true};
            } else if ((arg = parsePercent01(funcParts[4]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: false};
            }
          }

          if (color) {
            color.setRGB(colorParams.r, colorParams.g, colorParams.b)
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'rgb',
            normalizedText: `${funcName}(${textArgs.join(', ')})`,
            options: {rgb: options}
          };
        },

        generate: (color, options) => {
          var funcName = 'rgb', colorParams = color.getRGB(), textArgs = [];
          options = options.rgb;
          if (options.percentRGB.value) {
            textArgs.push(generatePercent(colorParams.r),
              generatePercent(colorParams.g), generatePercent(colorParams.b));
          } else {
            textArgs.push(generate255(colorParams.r),
              generate255(colorParams.g), generate255(colorParams.b));
          }
          if ((colorParams = color.getAlpha()) < 1 || options.includeA.value) {
            funcName = 'rgba';
            textArgs.push(options.percentA.value ?
              generatePercent(colorParams) : generatePercent01(colorParams));
          }
          return `${funcName}(${textArgs.join(', ')})`;
        }
      },
      {
        id: 'hex',
        options: [
          {
            id: 'notShort',
            label: 'Not short',
            description: 'Doesn\'t use shorter variant (i.e. 3/4 digits).'
          },
          {
            id: 'uc',
            label: 'UC',
            description: 'Uses upper-case characters.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. ff).'
          }
        ],

        parse: (text, color) => {
          var options = {}, colorParams = {}, matches, rgba;
          if (!(matches = text.match(RE_CSS_HEX))) { return null; }
          rgba = matches[1] ?
            matches.slice(1, 5) : matches.slice(5, 9).map(h => h ? `${h}${h}` : h);
          colorParams.r = fixNum(parseInt(rgba[0], 16) / 255, 0, 1);
          colorParams.g = fixNum(parseInt(rgba[1], 16) / 255, 0, 1);
          colorParams.b = fixNum(parseInt(rgba[2], 16) / 255, 0, 1);
          if (rgba[3]) { colorParams.a = fixNum(parseInt(rgba[3], 16) / 255, 0, 1); }
          if (matches[5]) { options.notShort = {value: false}; }
          if (/[A-F]/.test(text)) { // By one or more character.
            options.uc = {value: true};
            text = text.toUpperCase();
          } else if (/[a-f]/.test(text)) { // Don't set when all are number.
            options.uc = {value: false};
          }

          if (color) {
            color.setRGB(colorParams.r, colorParams.g, colorParams.b)
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'hex',
            normalizedText: text,
            options: {hex: options}
          };
        },

        generate: (color, options) => {
          var colorParams = color.getRGB(), textArgs, textArgsShort = [];
          options = options.hex;
          textArgs = ['r', 'g', 'b'].map(channel => colorParams[channel]);
          if ((colorParams = color.getAlpha()) < 1 || options.includeA.value) {
            textArgs.push(colorParams);
          }
          textArgs = textArgs.map(num01 => {
            var hex = ('00' + fixNum(num01 * 255, 0, 255, 0).toString(16)).substr(-2),
              matches = hex.match(/^(.)\1$/);
            if (matches) { textArgsShort.push(matches[1]); }
            return hex;
          });
          return '#' + (!options.notShort.value && textArgs.length === textArgsShort.length ?
            textArgsShort : textArgs).join('')[options.uc.value ? 'toUpperCase' : 'toLowerCase']();
        }
      },
      {
        id: 'named',
        // options: [
        //   {
        //     id: 'exact',
        //     label: 'Exact',
        //     description: 'Uses name to only exact color.'
        //   }
        // ],

        parse: (text, color) => {
          var cssColor, name;
          text = text.toLowerCase();
          if (!(cssColor = CSS_COLORS_WITH_DATA.find(cssColor => {
            var i;
            if (cssColor.name.toLowerCase() === text) {
              name = cssColor.name;
              return true;
            } else if (cssColor.alias && (i = cssColor.alias.indexOf(text)) > -1) {
              name = cssColor.alias[i];
              return true;
            }
            return false;
          }))) { return null; }

          if (color) {
            color.setRGB(cssColor.r, cssColor.g, cssColor.b)
              .setAlpha(typeof cssColor.a === 'number' ? cssColor.a : 1);
          }
          return {
            formatId: 'named',
            normalizedText: name
          };
        },

        generate: color => {
          var colorParams = color.getRGB(), cssColor;
          colorParams.a = color.getAlpha();
          return (cssColor = CSS_COLORS_WITH_DATA.find(cssColor =>
            cssColor.r === colorParams.r &&
            cssColor.g === colorParams.g &&
            cssColor.b === colorParams.b &&
            (typeof cssColor.a === 'number' ? cssColor.a : 1) === colorParams.a
          )) ? cssColor.name : null;
        }
      },
      {
        id: 'cmyk',
        options: [
          {
            id: 'percentCMYK',
            label: '<CMYK>%',
            description: 'Expresses <C>, <M>, <Y>, and <K> as percentage.',
            default: true
          },
          {
            id: 'percentA',
            label: '<A>%',
            description: 'Expresses <A> as percentage.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. 100% or 1.0).'
          },
          {
            id: 'includeF',
            label: '<F>',
            description: 'Includes <F>.'
          }
        ],
        funcNames: ['device-cmyk'],

        parse: (funcParts, color) => {
          var funcName = 'device-cmyk', options = {}, colorParams = {}, textArgs = [], arg;
          if (funcParts.length < 5) { return null; }
          options.percentCMYK = {value: false}; // Changed by one or more channel.
          // <C>, <M>, <Y>, <K>
          if (![['c', 1], ['m', 2], ['y', 3], ['k', 4]].every(ci => {
            var channel = ci[0], i = ci[1];
            if ((arg = parsePercent(funcParts[i]))) {
              colorParams[channel] = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentCMYK.value = true;
              return true;
            } else if ((arg = parsePercent01(funcParts[i]))) {
              colorParams[channel] = arg.num01;
              textArgs.push(arg.normalizedText);
              return true;
            }
            return false;
          })) { return null; }
          // <A>
          if (funcParts.length >= 6) {
            if ((arg = parsePercent(funcParts[5]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: true};
            } else if ((arg = parsePercent01(funcParts[5]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: false};
            }
          }
          // <F>
          if (funcParts.length >= 7 && funcParts[6] !== '') {
            textArgs.push(funcParts[6]);
            options.includeF = {value: true};
            savedCmykF = funcParts[6];
            savedCmykValues = [colorParams.c, colorParams.m, colorParams.y, colorParams.k,
              typeof colorParams.a === 'number' ? colorParams.a : 1];
          } else {
            savedCmykF = savedCmykValues = null;
          }

          if (color) {
            color.setCMYK(colorParams.c, colorParams.m, colorParams.y, colorParams.k)
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'cmyk',
            normalizedText: `${funcName}(${textArgs.join(', ')})`,
            options: {cmyk: options}
          };
        },

        generate: (color, options) => {
          var funcName = 'device-cmyk', colorParams = color.getCMYK(), colorParamsA, textArgs = [],
            optionsCMYK = options.cmyk;
          if (optionsCMYK.percentCMYK.value) {
            textArgs.push(generatePercent(colorParams.c), generatePercent(colorParams.m),
              generatePercent(colorParams.y), generatePercent(colorParams.k));
          } else {
            textArgs.push(generatePercent01(colorParams.c), generatePercent01(colorParams.m),
              generatePercent01(colorParams.y), generatePercent01(colorParams.k));
          }
          if ((colorParamsA = color.getAlpha()) < 1 || optionsCMYK.includeA.value) {
            textArgs.push(optionsCMYK.percentA.value ?
              generatePercent(colorParamsA) : generatePercent01(colorParamsA));
          }
          if (optionsCMYK.includeF.value) {
            textArgs.push(savedCmykValues && savedCmykValues.join(',') ===
                [colorParams.c, colorParams.m, colorParams.y, colorParams.k, colorParamsA].join(',') ?
              savedCmykF : formatsConfHash.rgb.generate(color, options));
          }
          return `${funcName}(${textArgs.join(', ')})`;
        }
      },
      {
        id: 'gray',
        options: [
          {
            id: 'percentS',
            label: '<S>%',
            description: 'Expresses <S> as percentage.',
            default: true
          },
          {
            id: 'percentA',
            label: '<A>%',
            description: 'Expresses <A> as percentage.'
          },
          {
            id: 'includeA',
            label: '<A>100',
            description: 'Includes <A> always, even when it\'s unneeded (i.e. 100% or 1.0).'
          }
        ],
        funcNames: ['gray'],

        parse: (funcParts, color) => {
          var funcName = 'gray', options = {}, colorParams = {}, textArgs = [], arg;
          if (funcParts.length < 2) { return null; }
          options.percentS = {value: false};
          // <S>
          if (!(arg = parse255(funcParts[1]))) {
            if (!(arg = parsePercent(funcParts[1]))) { return null; }
            options.percentS.value = true;
          }
          colorParams.s = arg.num01;
          textArgs.push(arg.normalizedText);
          // <A>
          if (funcParts.length >= 3) {
            if ((arg = parsePercent(funcParts[2]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: true};
            } else if ((arg = parsePercent01(funcParts[2]))) {
              colorParams.a = arg.num01;
              textArgs.push(arg.normalizedText);
              options.percentA = {value: false};
            }
          }

          if (color) {
            color.setRGB(colorParams.s, colorParams.s, colorParams.s)
              .setAlpha(typeof colorParams.a === 'number' ? colorParams.a : 1);
          }
          return {
            formatId: 'gray',
            normalizedText: `${funcName}(${textArgs.join(', ')})`,
            options: {gray: options}
          };
        },

        generate: (color, options) => {
          var funcName = 'gray', colorParams = color.getRGB(), textArgs = [];
          if (colorParams.r !== colorParams.g ||
            colorParams.r !== colorParams.b) { return null; }
          options = options.gray;
          if (options.percentS.value) {
            textArgs.push(generatePercent(colorParams.r));
          } else {
            textArgs.push(generate255(colorParams.r));
          }
          if ((colorParams = color.getAlpha()) < 1 || options.includeA.value) {
            textArgs.push(options.percentA.value ?
              generatePercent(colorParams) : generatePercent01(colorParams));
          }
          return `${funcName}(${textArgs.join(', ')})`;
        }
      }
    ].map(formatConf => {
      if (FORMATS_NAME[formatConf.id]) {
        ['label', 'guide', 'description'].forEach(key => {
          if (FORMATS_NAME[formatConf.id][key]) {
            formatConf[key] = FORMATS_NAME[formatConf.id][key];
          }
        });
      }
      return formatConf;
    }),

    FUNCNAME2FORMAT = FORMATS_CONF.reduce((funcName2format, formatConf) => {
      if (formatConf.funcNames) {
        formatConf.funcNames.forEach(
          funcName => { funcName2format[funcName] = formatConf.id; });
      }
      return funcName2format;
    }, {}),
    FORMATS_NOT_FUNC = FORMATS_CONF.reduce((formatIds, formatConf) => {
      if (!formatConf.funcNames) { formatIds.push(formatConf.id); }
      return formatIds;
    }, []),

    RE_SINGLE_PAREN = new RegExp('\\([^\\(]*?\\)', 'g'),
    PTN_CSS_FUNC = FORMATS_CONF.reduce((funcNames, formatConf) => {
      if (formatConf.funcNames) {
        funcNames = funcNames.concat(
          formatConf.funcNames.map(funcName => funcName.replace(/[\x00-\x7f]/g,
            s => '\\x' + ('00' + s.charCodeAt().toString(16)).substr(-2))));
      }
      return funcNames;
    }, []).join('|'),
    RE_CSS_FUNC = new RegExp(`^(${PTN_CSS_FUNC}) *\\(([\\s\\S]*)\\)$`, 'i'),
    RE_CSS_COMMENT = /\/\*[\s\S]*?\*\//g,

    /* eslint-disable key-spacing */
    FORMS = {
      // swatchesWidth/Height: 12/cell
      default: {
        parts: ['map', 'bar', 'preview', 'hsv', 'rgb', 'alpha', 'lab', 'cmyk',
          'swatches', 'swatchesswitcher', 'formats', 'formatsfooter'],
        layout: {
          map:                [0, 0, 1, 5],
          bar:                [1, 0, 1, 5],
          preview:            [2, 0, 1, 1],
          hsv:                [2, 1, 1, 1],
          swatchesswitcher:   [2, 2, 2, 1],
          swatches:           [2, 3, 2, 2],
          alpha:              [3, 0, 2, 1],
          rgb:                [3, 1, 2, 1],
          formats:            [4, 2, 3, 2],
          formatsfooter:      [4, 4, 3, 1],
          lab:                [5, 1, 1, 1],
          cmyk:               [6, 0, 1, 2]
        },
        swatchesWidth: 132,
        swatchesHeight: 96,
        edit: $colorpicker => {
          $('.ui-colorpicker > table', $colorpicker).prepend('<colgroup><col span="1"><col span="1"><col span="1"><col span="1" style="width: 20px;"><col span="1" style="width: 107px;"></colgroup>');
        }
      },
      largePalette: {
        parts: ['map', 'bar', 'preview', 'hsv', 'rgb', 'alpha', 'lab', 'cmyk',
          'swatches', 'swatchesswitcher', 'formats', 'formatsfooter'],
        layout: {
          map:                [0, 0, 1, 6],
          bar:                [1, 0, 1, 6],
          preview:            [2, 0, 1, 1],
          hsv:                [2, 1, 1, 1],
          rgb:                [2, 2, 1, 2],
          alpha:              [2, 4, 1, 2],
          lab:                [3, 1, 1, 1],
          cmyk:               [3, 2, 1, 4],
          swatchesswitcher:   [4, 0, 1, 1],
          swatches:           [4, 1, 1, 2],
          formats:            [4, 3, 1, 2],
          formatsfooter:      [4, 5, 1, 1]
        },
        swatchesWidth: 288,
        swatchesHeight: 96
      },
      simple: {
        parts: ['map', 'bar', 'preview', 'hsv', 'rgb', 'alpha', 'formats', 'formatsfooter'],
        layout: {
          map:                [0, 0, 1, 4],
          bar:                [1, 0, 1, 4],
          preview:            [2, 0, 1, 1],
          hsv:                [2, 1, 1, 1],
          formats:            [2, 2, 2, 1],
          formatsfooter:      [2, 3, 2, 1],
          alpha:              [3, 0, 1, 1],
          rgb:                [3, 1, 1, 1]
        }
      },
      compact: {
        parts: ['map', 'bar', 'preview', 'hsv', 'alpha', 'formats', 'formatsfooter'],
        layout: {
          map:                [0, 0, 1, 3],
          bar:                [1, 0, 1, 3],
          preview:            [2, 0, 1, 1],
          hsv:                [2, 1, 1, 1],
          alpha:              [2, 2, 1, 1],
          formats:            [0, 3, 3, 1],
          formatsfooter:      [0, 4, 3, 2]
        },
        mapSize: 128,
        barSize: 128
      },
      compact2: {
        parts: ['map', 'bar', 'preview', 'hsv', 'alpha', 'formats', 'formatsfooter'],
        layout: {
          map:                [0, 0, 1, 4],
          bar:                [1, 0, 1, 4],
          preview:            [2, 0, 1, 1],
          hsv:                [2, 1, 1, 2],
          alpha:              [2, 3, 1, 1],
          formats:            [3, 0, 1, 2],
          formatsfooter:      [3, 2, 1, 2]
        },
        mapSize: 128,
        barSize: 128
      },
      byPalette: {
        parts: ['swatches', 'swatchesswitcher', 'preview', 'formats', 'formatsfooter'],
        layout: {
          preview:            [0, 0, 1, 1],
          swatchesswitcher:   [1, 0, 1, 1],
          swatches:           [0, 1, 2, 1],
          formats:            [0, 2, 2, 1],
          formatsfooter:      [0, 3, 2, 1]
        },
        swatchesWidth: 288,
        swatchesHeight: 96
      }
    };
    /* eslint-enable key-spacing */

  /**
   * @param {string} text - The text to be parsed.
   * @returns {Array} funcParts - The parts of a function notation. [<lower-cased function-name>, <arg1>, <arg2>, ...]
   * @returns {boolean} funcParts - false: A function notation is caught, but it has error (it's not another notation).
   * @returns {null} funcParts - null: `text` is not function notation (it might be another notation).
   */
  function parseFunc(text) {
    var hiddenText = [], matches, funcName, args;

    function addHiddenText(text) {
      if (typeof text !== 'string' || text === '') { return ''; }
      hiddenText.push(text);
      return '\f' + (hiddenText.length - 1) + '\x07';
    }

    // Redo String#replace until target is not found
    function replaceComplete(text, re, fnc) {
      var doNext = true, reg = new RegExp(re); // safe (not literal)
      function fncWrap() {
        doNext = true;
        return fnc.apply(null, arguments);
      }
      // This is faster than using RegExp#exec() and RegExp#lastIndex,
      // because replace() isn't called more than twice in almost all cases.
      while (doNext) {
        doNext = false;
        text = text.replace(reg, fncWrap);
      }
      return text;
    }

    if (!(matches = RE_CSS_FUNC.exec(text))) { return null; }
    if (/\f|\x07/.test(text)) { return false; }
    funcName = matches[1].toLowerCase();
    if (matches[2].trim() === '') { return [funcName]; }

    RE_SINGLE_PAREN.lastIndex = 0;
    args = replaceComplete(matches[2], RE_SINGLE_PAREN, s => addHiddenText(s)); // hide nesting
    if (/\(|\)/.test(args)) { return false; }
    return [funcName].concat(
      replaceComplete(args.replace(/,/g, '\fsep\x07'), // mark points to separate
        /\f(\d+)\x07/g, (s, i) => hiddenText[i] || '') // restore hidden texts
      .split('\fsep\x07').map(arg => arg.trim()) // get args
    );
  }

  /**
   * @param {string} text - The text to be parsed.
   * @param {$.colorpicker.Color} [color] - The current $.colorpicker.Color to update a color.
   * @returns {Object|null} parsedColor
   * @returns {string} parsedColor.formatId
   * @returns {string} parsedColor.normalizedText - The normalized text.
   * @returns {Object} [parsedColor.options] - The options to change formats. (e.g. {<optionId>: <boolean or any>})
   */
  function parseText(text, color) {
    var funcParts, format;
    if (typeof text !== 'string' || text === '') { return null; }
    text = text.trim().replace(RE_CSS_COMMENT, '');

    if ((funcParts = parseFunc(text)) === false) { return null; }
    if (funcParts) {
      return formatsConfHash[FUNCNAME2FORMAT[funcParts[0]]].parse(funcParts, color);
    }

    return FORMATS_NOT_FUNC.some(formatId => {
      if ((format = formatsConfHash[formatId].parse(text, color))) {
        return true; // found and exit loop
      } else if (format === false) {
        format = null;
        return true; // abort loop
      }
      return false;
    }) ? format : null;
  }

  /**
   * @param {Object} element - An element of raw data.
   * @returns {Object|null} paletteElement - A palette element.
   */
  function parsePaletteElement(element) {
    var color, paletteElement, arg = {};

    // Return a valid value that can be a number the user wants.
    function asNumber(value) {
      var type;
      return value == null || (type = typeof value) === 'object' ? false : // eslint-disable-line eqeqeq
        type === 'number' ? value :
        /^[\+\-]?\d+(?:\.\d+)?$/.test((value = (value + '').trim())) ? +value : false;
    }

    // Return a valid value that can be a string the user wants.
    function asString(value) {
      return value != null && typeof value !== 'object' && // eslint-disable-line eqeqeq
        (value += '') !== '' ? value : false;
    }

    if ((arg.color = asString(element)) !== false) {
      if (parseText(arg.color, (color = new $.colorpicker.Color()))) {
        paletteElement = color.getRGB();
        paletteElement.a = color.getAlpha();
        return paletteElement;
      }

    } else if (Array.isArray(element)) {
      if ((arg.r = asNumber(element[0])) !== false &&
          (arg.g = asNumber(element[1])) !== false && (arg.b = asNumber(element[2])) !== false) {
        paletteElement = {
          r: fixNum(arg.r, 0, 1, 5),
          g: fixNum(arg.g, 0, 1, 5),
          b: fixNum(arg.b, 0, 1, 5)
        };
        if ((arg.a = asNumber(element[3])) !== false) {
          paletteElement.a = fixNum(arg.a, 0, 1, 5);
          if ((arg.name = asString(element[4])) !== false) { paletteElement.name = arg.name; }
        } else {
          paletteElement.a = 1;
          if ((arg.name = asString(element[3])) !== false) { paletteElement.name = arg.name; }
        }
        return paletteElement;

      } else if ((arg.color = asString(element[0])) !== false) {
        if (parseText(arg.color, (color = new $.colorpicker.Color()))) {
          paletteElement = color.getRGB();
          paletteElement.a = color.getAlpha();
          if ((arg.name = asString(element[1])) !== false) { paletteElement.name = arg.name; }
          return paletteElement;
        }
      }

    } else if ((arg.color = asString(element.color)) !== false) {
      if (parseText(arg.color, (color = new $.colorpicker.Color()))) {
        paletteElement = color.getRGB();
        paletteElement.a = color.getAlpha();
        if ((arg.name = asString(element.name)) !== false) { paletteElement.name = arg.name; }
        return paletteElement;
      }

    } else {
      if ((arg.r = asNumber(element.r)) !== false &&
          (arg.g = asNumber(element.g)) !== false && (arg.b = asNumber(element.b)) !== false) {
        paletteElement = {
          r: fixNum(arg.r, 0, 1, 5),
          g: fixNum(arg.g, 0, 1, 5),
          b: fixNum(arg.b, 0, 1, 5)
        };

      } else if ((arg.h = asNumber(element.h)) !== false && (arg.s = asNumber(element.s)) !== false &&
          ((arg.b = asNumber(element.b)) !== false || (arg.b = asNumber(element.v)) !== false)) {
        paletteElement = (new $.colorpicker.Color()).setHSV(arg.h, arg.s, arg.b).getRGB();

      } else if ((arg.h = asNumber(element.h)) !== false
          && (arg.s = asNumber(element.s)) !== false && (arg.l = asNumber(element.l)) !== false) {
        paletteElement = (new $.colorpicker.Color()).setHSL(arg.h, arg.s, arg.l).getRGB();

      } else if ((arg.h = asNumber(element.h)) !== false
          && (arg.w = asNumber(element.w)) !== false && (arg.b = asNumber(element.b)) !== false) {
        paletteElement = hwb2rgb(arg);

      } else if ((arg.c = asNumber(element.c)) !== false && (arg.m = asNumber(element.m)) !== false &&
          (arg.y = asNumber(element.y)) !== false && (arg.k = asNumber(element.k)) !== false) {
        paletteElement = (new $.colorpicker.Color()).setCMYK(arg.c, arg.m, arg.y, arg.k).getRGB();

      } else if ((arg.s = asNumber(element.s)) !== false) { // must check after others that have `s`
        paletteElement = {
          r: fixNum(arg.s, 0, 1, 5),
          g: fixNum(arg.s, 0, 1, 5),
          b: fixNum(arg.s, 0, 1, 5)
        };
      }

      if (paletteElement) {
        paletteElement.a = (arg.a = asNumber(element.a)) !== false ? fixNum(arg.a, 0, 1, 5) : 1;
        if ((arg.name = asString(element.name)) !== false) { paletteElement.name = arg.name; }
        return paletteElement;
      }
    }
    return null;
  }

  function commit() {
    getInput().datalist('hide'); // polyfill
    $colorpicker.css('display', 'none'); // refresh view forcedly, erase after-image for next time.
    initOptions.commit.apply(null, arguments);
  }

  var form = initOptions.form && FORMS[initOptions.form] ? initOptions.form : 'default',
    getCurOptions;

  formatsConfHash = FORMATS_CONF.reduce((formatsConfHash, formatConf) => {
    formatsConfHash[formatConf.id] = formatConf;
    return formatsConfHash;
  }, {});

  $.colorpicker.Color.fixNum = fixNum; // for _clip

  $colorpicker = $('<span id="color-picker"/>')
    .addClass(`form-${form}`).appendTo('body')
    .colorpicker({
      alpha: true,
      closeOnEscape: false,
      closeOnOutside: false,
      draggable: false,

      parts: FORMS[form].parts,
      layout: FORMS[form].layout,
      swatchesWidth: FORMS[form].swatchesWidth,
      swatchesHeight: FORMS[form].swatchesHeight,

      formatsConf: FORMATS_CONF,
      part: {
        formats: {
          parser: parseText,
          ok: commit,
          cancel: commit,
          bindValueGetter: getter => { getValue = getter; },
          bindValueSetter: setter => { setValue = setter; },
          bindFormatsGetter: getter => { getFormats = getter; },
          bindFormatsSetter: setter => { setFormats = setter; },
          bindInputGetter: getter => { getInput = getter; },
          bindCurOptionsGetter: getter => { getCurOptions = getter; }
        },
        swatchesswitcher: {
          storeDir: initOptions.storeDir,
          parser: parsePaletteElement,
          defaultPalette: CSS_COLORS_WITH_DATA,
          defaultPaletteLabel: 'CSS Colors',
          bindPaletteGetter: getter => { getPalette = getter; },
          bindPaletteSetter: setter => { setPalette = setter; }
        },
        map: { size: FORMS[form].mapSize },
        bar: { size: FORMS[form].barSize }
      }
    });
  if (FORMS[form].edit) { FORMS[form].edit($colorpicker); }

  initOptions.resizeWindow(
    $colorpicker.outerWidth() + BODY_PADDING_LEFT + BODY_PADDING_RIGHT,
    $colorpicker.outerHeight() + BODY_PADDING_TOP + BODY_PADDING_BOTTOM,
    initOptions.stats.x, initOptions.stats.y);

  convert = (text, formatId) => {
    var color;
    return typeof text === 'string' &&
      (text = text.trim()) !== '' &&
      formatsConfHash[formatId] &&
      parseText(text, (color = new $.colorpicker.Color())) ?
        formatsConfHash[formatId].generate(color, getCurOptions()) : null;
  };
}

exports.init = initOptions => {
  if (!$colorpicker ||
      initOptions.form !== remakeOptions.form ||
      initOptions.storeDir !== remakeOptions.storeDir) {

    if ($colorpicker) {
      if (getInput) { getInput().datalist('destroy').remove(); }
      $colorpicker.colorpicker('destroy').remove();
      getValue = setValue = getFormats = setFormats =
        getPalette = setPalette = getInput = convert = null;
    }

    remakeOptions.form = initOptions.form;
    remakeOptions.storeDir = initOptions.storeDir;

    createUi(initOptions);
    setFormats(initOptions.stats);
    if (setPalette) { setPalette(initOptions.stats.palette); }
  }

  if (initOptions.command === 'pick') {
    $colorpicker.css('display', ''); // See commit().
    setValue(initOptions.value || initOptions.stats.value, true);
    return null;
  } else { // convert
    $colorpicker.css('display', 'none'); // constructor needs display
    return convert;
  }
};

exports.getStats = () => {
  var stats = getFormats ? getFormats() : {};
  if (getValue) { stats.value = getValue(); }
  if (getPalette) { stats.palette = getPalette(); }
  return stats;
};
