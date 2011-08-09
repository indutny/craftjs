/**
 * Craft.js - main library file
 *
 * @author Fedor Indutny.
 */

var craftjs = exports;

// Native parser
craftjs.ProtocolParser = require('./native/craftjs').ProtocolParser;

// Utils
craftjs.utils = require('./craftjs/utils');

// MCStream
craftjs.MCStream = require('./craftjs/mcstream').MCStream;

// Core
craftjs.create = require('./craftjs/core').create;
