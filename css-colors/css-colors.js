'use strict';

const fs = require('fs');

function fixNum(num, min, max, digits) {
  var exp;
  if (typeof min === 'number' && num < min) { return min; }
  if (typeof max === 'number' && num > max) { return max; }
  if (!/\./.test(num + '')) { return num; }
  if (typeof digits !== 'number') { digits = 3; }
  exp = Math.pow(10, digits);
  return Math.round(num * exp) / exp;
}

function getHSV(color) {
  var min = Math.min(color.r, color.g, color.b),
    max = Math.max(color.r, color.g, color.b),
    delta = max - min, hsv = {h: 0, s: 0, v: max},
    deltaR, deltaG, deltaB;

  if (delta === 0) {
    hsv.h = 0;
    hsv.s = 0;
  } else {
    hsv.s = delta / max;
    deltaR = ((max - color.r) / 6 + delta / 2) / delta;
    deltaG = ((max - color.g) / 6 + delta / 2) / delta;
    deltaB = ((max - color.b) / 6 + delta / 2) / delta;
    if (color.r === max) {
      hsv.h = deltaB - deltaG;
    } else if (color.g === max) {
      hsv.h = (1 / 3) + deltaR - deltaB;
    } else if (color.b === max) {
      hsv.h = (2 / 3) + deltaG - deltaR;
    }
    if (hsv.h < 0) {
      hsv.h += 1;
    } else if (hsv.h > 1) {
      hsv.h -= 1;
    }
  }
  hsv.h = Math.max(0, Math.min(hsv.h, 1));
  hsv.s = Math.max(0, Math.min(hsv.s, 1));
  hsv.v = Math.max(0, Math.min(hsv.v, 1));
  return hsv;
}

function getLAB(color) {
  // https://en.wikipedia.org/wiki/Standard_illuminant
  const illuminant = [0.9504285, 1, 1.0889]; // CIE-L*ab D65/2' 1931
  var
    r = (color.r > 0.04045) ? Math.pow((color.r + 0.055) / 1.055, 2.4) : color.r / 12.92,
    g = (color.g > 0.04045) ? Math.pow((color.g + 0.055) / 1.055, 2.4) : color.g / 12.92,
    b = (color.b > 0.04045) ? Math.pow((color.b + 0.055) / 1.055, 2.4) : color.b / 12.92,
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / illuminant[0],
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / illuminant[1],
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / illuminant[2];

  x = (x > 0.008856) ? Math.pow(x, (1 / 3)) : (7.787 * x) + (16 / 116);
  y = (y > 0.008856) ? Math.pow(y, (1 / 3)) : (7.787 * y) + (16 / 116);
  z = (z > 0.008856) ? Math.pow(z, (1 / 3)) : (7.787 * z) + (16 / 116);

  return {
    l: ((116 * y) - 16) / 100,          // [0,100]
    a: ((500 * (x - y)) + 128) / 255,   // [-128,127]
    b: ((200 * (y - z)) + 128) / 255    // [-128,127]
  };
}

var
  cssColors = fs.readFileSync('./css-colors.txt', {encoding: 'utf8'})
    .split('\n').reduce((cssColors, line) => {
      var cols, color = {}, channels;
      if (!line) { return cssColors; }
      cols = line.trim().split('\t');

      color.name = cols[0].trim();
      if (cols[1]) {
        channels = cols[1].trim().split(',');
        color.r = fixNum(channels[0] / 255, 0, 1, 5);
        color.g = fixNum(channels[1] / 255, 0, 1, 5);
        color.b = fixNum(channels[2] / 255, 0, 1, 5);
        color.a = channels.length >= 4 ? fixNum(+channels[3], 0, 1, 5) : 1;
        let same = cssColors.find(existColor =>
          existColor.r === color.r &&
          existColor.g === color.g &&
          existColor.b === color.b &&
          existColor.a === color.a);
        if (same) {
          (same.alias = same.alias || []).push(color.name);
          return cssColors;
        }
      }
      cssColors.push(color);
      return cssColors;
    }, []),

  // base = getLAB({r: 0, g: 0, b: 0}),
  colorMap = cssColors.reduce((colorMap, color) => {
    if (typeof color.r === 'number') {
      let hsv = getHSV(color), lab = getLAB(color);
      colorMap[color.name] = {h: hsv.h, s: hsv.s, v: hsv.v, l: lab.l, a: lab.a, b: lab.b};
      colorMap[color.name].sortKey = color.name === 'transparent' ? 1000 :
        hsv.s < 0.01 ? -100 + hsv.v : Math.round(hsv.h * 100 / 15) * 15 - hsv.s + hsv.v * 2;
      // colorMap[color.name].sortKey = color.name === 'transparent' ? 1000 :
      //   Math.pow(lab.l - base.l, 2) + Math.pow(lab.a - base.a, 2) + Math.pow(lab.b - base.b, 2);
    } else {
      colorMap[color.name] = {sortKey: 2000};
    }
    return colorMap;
  }, {});

cssColors.sort((a, b) => colorMap[a.name].sortKey - colorMap[b.name].sortKey);

fs.writeFileSync('../lib/css-colors.json', JSON.stringify(cssColors));
// for test
fs.writeFileSync('../test/css-colors.js',
  `window.cssColors = ${JSON.stringify(cssColors)};`);

// HTML for check
fs.writeFileSync('./css-colors.html',
`<!DOCTYPE html>
<html>
<head>
<style>
table { border-collapse: collapse; }
td { border: 1px solid #ccc; }
td:nth-of-type(6) { width: 100px; }
</style>
<title>css-colors</title>
</head>
<body>
<table>
${
  cssColors.map((color, i) => {
    var css;
    if (typeof color.r === 'number') {
      css = `${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}`;
      css = typeof color.a === 'number' ? `rgba(${css}, ${Math.round(color.a)})` : `rgb(${css})`;
    }
    return `<tr><td>${i}</td>` +
      `<td><code>${color.name || ''}</code></td>` +
      (css ? `<td><code>${css}</code></td>` +
        `<td><code>hsb(${Math.round(colorMap[color.name].h * 360)},` +
          ` ${Math.round(colorMap[color.name].s * 100)}%,` +
          ` ${Math.round(colorMap[color.name].v * 100)}%)</code></td>` +
        `<td><code>Lab(${Math.round(colorMap[color.name].l * 100) / 100},` +
          ` ${Math.round(colorMap[color.name].a * 100) / 100},` +
          ` ${Math.round(colorMap[color.name].b * 100) / 100})</code></td>` +
        `<td style="background-color: ${css}">&nbsp;</td></tr>` : '');
  }).join('')
}
</table>
</body>
</html>`);
