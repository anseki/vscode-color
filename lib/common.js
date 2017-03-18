
'use strict';

const
  fs = require('fs'),
  FORMATS = ['hsb', 'hsl', 'hwb', 'rgb', 'hex', 'named', 'cmyk', 'gray'],
  STATS_PATH = require('path').join(__dirname, '../stats.json');

exports.FORMATS = FORMATS;

function loadStats() {
  try {
    // Don't use `require` to avoid caching.
    return JSON.parse(fs.readFileSync(STATS_PATH, {encoding: 'utf8'}));
  } catch (error) { return null; }
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats));
  } catch (error) { /* ignore */ }
}

exports.loadStats = loadStats;
exports.saveStats = saveStats;

exports.getFormatsOrder = (configOrder, statsOrder) => {
  const defaultOrder = FORMATS.slice(), order = [];
  // configOrder > statsOrder > defaultOrder

  // returns `true` if the `order` is completed.
  function merge(list) {
    return list.some(formatId => {
      const i = defaultOrder.indexOf(formatId);
      if (i > -1) {
        order.push(formatId);
        defaultOrder.splice(i, 1);
        if (!defaultOrder.length) { return true; }
      }
      return false;
    });
  }

  if (Array.isArray(configOrder) && merge(configOrder)) { return order; }

  if (!statsOrder) { statsOrder = (loadStats() || {}).formatsOrder; }
  if (Array.isArray(statsOrder) && merge(statsOrder)) { return order; }

  defaultOrder.forEach(formatId => { order.push(formatId); });
  return order;
};

exports.hoistFormatsOrder = (order, formatId) => {
  const i = order.indexOf(formatId);
  if (i > -1) { order.splice(i, 1); }
  order.unshift(formatId);
};
