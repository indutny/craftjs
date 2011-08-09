/**
 * Craft.js - MCStream
 *
 * @author Fedor Indutny.
 */

var util = require('util'),
    zlib = require('zlib'),
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
    buffer.writeUInt16(packet.hash.length, 1, 'big');

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
    buffer.writeUInt32(packet.entityID, 1, 'big');

    // Put unknown string length
    buffer.writeUInt16(0, 5, 'big');

    // Put map seed
    packet.seed.copy(buffer, 7, 0, 8);

    // Dimension
    buffer[15] = packet.dimension & 0xff;
  } else if (type === 'spawnPosition') {
    buffer = new Buffer(13);

    // Type
    buffer[0] = 0x06;

    // X
    buffer.writeInt32(packet.x, 1, 'big');

    // Y
    buffer.writeInt32(packet.y, 5, 'big');

    // Z
    buffer.writeInt32(packet.z, 9, 'big');
  } else if (type === 'playerPosition') {
    buffer = new Buffer(34);

    // Type
    buffer[0] = 0x0b;

    // X
    buffer.writeDouble(packet.x, 1, 'big');

    // Y
    buffer.writeDouble(packet.y, 9, 'big');

    // Stance
    buffer.writeDouble(packet.stance, 17, 'big');

    // Z
    buffer.writeDouble(packet.z, 25, 'big');

    // On Ground
    buffer[33] = packet.onGround ? 1 : 0;
  } else if (type === 'playerPositionAndLook') {
    buffer = new Buffer(42);

    // Type
    buffer[0] = 0x0d;

    // X
    buffer.writeDouble(packet.x, 1, 'big');

    // Stance
    buffer.writeDouble(packet.stance, 9, 'big');

    // Y
    buffer.writeDouble(packet.y, 17, 'big');

    // Z
    buffer.writeDouble(packet.z, 25, 'big');

    // Yaw
    buffer.writeFloat(packet.yaw, 33, 'big');

    // Pitch
    buffer.writeFloat(packet.pitch, 37, 'big');

    // On Ground
    buffer[41] = packet.onGround ? 1 : 0;
  } else if (type === 'prechunk') {
    buffer = new Buffer(10);

    // Type
    buffer[0] = 0x32;

    // X
    buffer.writeInt32(packet.x, 1, 'big');

    // Z
    buffer.writeInt32(packet.z, 5, 'big');

    // Mode
    buffer[9] = packet.mode;
  } else if (type === 'chunk') {
    var chunk = zlib.deflate(packet.chunk);

    buffer = new Buffer(18 + chunk.length);

    // Type
    buffer[0] = 0x33;

    // X
    buffer.writeInt32(packet.x, 1, 'big');

    // Y
    buffer.writeInt16(packet.y, 5, 'big');

    // Z
    buffer.writeInt32(packet.z, 7, 'big');

    // Size X
    buffer[11] = packet.sizeX & 0xf;

    // Size Y
    buffer[12] = packet.sizeY & 0x7f;

    // Size Z
    buffer[13] = packet.sizeZ & 0xf;

    // Compressed Size
    buffer.writeUInt32(chunk.length, 14, 'big');

    // Compressed data
    chunk.copy(buffer, 18);
  }

  if (buffer) this.connection.write(buffer);
};
