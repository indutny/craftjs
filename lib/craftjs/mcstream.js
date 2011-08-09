/**
 * Craft.js - MCStream
 *
 * @author Fedor Indutny.
 */

var util = require('util'),
    Buffer = require('buffer').Buffer,
    EventEmitter = process.EventEmitter;

var MCStream = exports.MCStream = function MCStream(protocolParser, c) {
  EventEmitter.call(this);
  this.protocolParser = protocolParser;

  this.clearstream = new EventEmitter;
  this.connection = c;

  var that = this,
      buffers = this.buffers = [];

  this.buffersTotal = 0;

  this.clearstream.on('data', function(data) {
    if (data.length <= 0) return;

    buffers.push(data);
    that.buffersTotal += data.length;

    that.parse();
  });
};
util.inherits(MCStream, EventEmitter);

MCStream.prototype.parse = function parse() {
  var that = this,
      buffers = this.buffers,
      parseResult = this.protocolParser.parse(buffers[0]);

  if (parseResult.bytesWaiting > 0) {
    if (parseResult.bytesWaiting <= this.buffersTotal) {
      // Join buffers and run parse() again
      var size = 0,
          count = 0,
          bigBuffer;

      while (size < parseResult.bytesWaiting) {
        size += buffers[count].length;
        count++;
      }

      bigBuffer = new Buffer(size);

      for (var i = 0, offset = 0; i < count; i++) {
        var buffer = buffers.shift();
        buffer.copy(bigBuffer, offset, buffer.length);
        offset += buffer.length;
      }

      buffers.unshift(bigBuffer);
      this.parse();
    } else {
      // We have not enough data, wait...
    }
  } else {
    var buffer = buffers.shift();
    this.buffersTotal -= buffer.length;

    parseResult.forEach(function(packet) {
      that.emit('packet', packet);
    });

    if (buffers.length > 0) this.parse();
  }
};

MCStream.prototype.write = function write(type, packet) {
  var buffer;

  if (type === 'handshake') {
    buffer = new Buffer(3 + (packet.hash.length << 1));

    // Type
    buffer[0] = 0x02;

    // Put string length
    buffer[1] = (packet.hash.length >> 8) & 0xff;
    buffer[2] = packet.hash.length & 0xff;

    // Put string in Big-Endian
    for (var i = 0, len = packet.hash.length; i < len; i++) {
      buffer[3 + (i << 1)] = 0;
      buffer[4 + (i << 1)] = packet.hash.charCodeAt(i);
    }
  } else if (type === 'loginResponse') {
    buffer = new Buffer(16);

    // Type
    buffer[0] = 0x01;

    // Encode Entity ID
    buffer[1] = (packet.entityID >> 24) & 0xff;
    buffer[2] = (packet.entityID >> 16) & 0xff;
    buffer[3] = (packet.entityID >> 8) & 0xff;
    buffer[4] = packet.entityID & 0xff;

    // Put unknown string length
    buffer[5] = 0;
    buffer[6] = 0;

    // Put map seed
    packet.seed.copy(buffer, 7, 0, 8);

    // Dimension
    buffer[15] = packet.dimension & 0xff;
  }

  if (buffer) this.connection.write(buffer);
};
