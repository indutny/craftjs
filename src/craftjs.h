#ifndef SRC_CRAFTJS_H_
#define SRC_CRAFTJS_H_

#include <stdlib.h>
#include <v8.h>
#include <node_object_wrap.h>
#include <node_buffer.h>

namespace node {
namespace craftjs {

typedef enum {
  KeepAlive = 0x00,
  LoginRequest = 0x01,
  Handshake = 0x02,
  Player = 0x0a,
  PlayerPosition = 0x0b,
  PlayerLook = 0x0c,
  PlayerPositionAndLook = 0x0d,
  PlayerDigging = 0x0e,
  Animation = 0x12,
  Disconnect = 0xff
} PacketType;

v8::Handle<v8::String> getJavaString16(char *data, uint16_t length);

double getJavaDouble(char *data);
float getJavaFloat(char *data);

class ProtocolParser : ObjectWrap {
 public:

  static void Initialize(v8::Handle<v8::Object> target);

 protected:
  static v8::Handle<v8::Value> New(const v8::Arguments &args);
  static v8::Handle<v8::Value> Parse(const v8::Arguments &args);
};

} // namespace craftjs
} // namespace node

#endif
