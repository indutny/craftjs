/**
 * Craft.js - Core
 *
 * @author Fedor Indutny.
 */

var craftjs = require('../craftjs'),
    util = require('util');
    net = require('net'),
    MCStream = craftjs.MCStream;

var core = exports;

var Server = core.Server = function Server(options) {
  net.Server.call(this);

  this.options = options = craftjs.utils.merge({
    port: 25565,
    host: '0.0.0.0'
  }, options);

  var protocolParser = this.protocolParser = new craftjs.ProtocolParser();

  var that = this;
  this.on('connection', function(c) {
    var stream = new MCStream(protocolParser, c);

    c.on('data', function(data) {
      stream.clearstream.emit('data', data);
    });

    that.onConnection(stream);
  });

  this.listen(options.port, options.host);
};
util.inherits(Server, net.Server);

core.create = function create(options) {
  return new Server(options);
};

Server.prototype.onConnection = function onConnection(c) {
  c.on('packet', function(packet) {
    console.log(packet);

    if (packet.type === 'handshake') {
      c.write('handshake', {
        hash: 'abcd' // TODO: This is temporary
      });
    } else if (packet.type === 'loginRequest') {
      c.write('loginResponse', {
        entityID: ~~(Math.random() * 1e9),
        seed: new Buffer([0, 0, 0, 0, 0, 0, 0, 0]),
        dimension: 0
      });
      c.write('spawnPosition', {
        x: 1,
        y: 51,
        z: 1
      });
      c.write('prechunk', {
        x: 0,
        z: 0,
        mode: 1
      });
      c.write('chunk', {
        x: 0,
        y: 20,
        z: 0,
        sizeX: 3,
        sizeY: 0,
        sizeZ: 3,
        chunk: new Buffer([0x29, 0x29, 0x29, 0x29, 0x29,
                           0x29, 0x29, 0x29, 0x29, 0x29,
                           0x29, 0x29, 0x29, 0x29, 0x29,
                           0x29, 0, 0, 0, 0,
                           0, 0, 0, 0xff, 0xff,
                           0xff, 0xff, 0xff, 0xff, 0xff,
                           0xff, 0xff, 0xff, 0xff, 0xff,
                           0xff, 0xff, 0xff, 0xff])
      });
      c.write('playerPosition', {
        x: 2,
        y: 32,
        stance: 33,
        z: 2,
        onGround: true
      });
    } else if (packet.type === 'playerPosition') {
      // Confirm position
      c.write('playerPosition', packet);
    }
  });
};
