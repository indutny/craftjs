/**
 * Craft.js - Utils
 *
 * @author Fedor Indutny.
 */

var utils = exports;

utils.merge = function merge(a, b) {
  var c = {};

  if (a) {
    for (var i in a) {
      if (a.hasOwnProperty(i)) c[i] = a[i];
    }
  }

  if (b) {
    for (var i in b) {
      if (b.hasOwnProperty(i)) {
        c[i] = typeof b[i] === 'object' && typeof c[i] === 'object' ?
                  merge(c[i], b[i])
                  :
                  b[i];
      }
    }
  }

  return c;
};
