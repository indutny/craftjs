#include "craftjs.h"
#include <stdlib.h>
#include <v8.h>
#include <node.h>
#include <node_buffer.h>

using namespace v8;

namespace node {
namespace craftjs {

Handle<String> getJavaString16(char *data, uint16_t length) {
  HandleScope scope;

  char *result = static_cast<char*>(calloc(1, length << 1));

  for (int i = 0; i < length; i++) {
    result[i << 1] = data[(i << 1) + 1];
    result[(i << 1) + 1] = data[i << 1];
  }

  Local<String> _result = String::New(reinterpret_cast<uint16_t*>(result),
                                      length);

  free(result);
  return scope.Close(_result);
}

double getJavaDouble(char *data) {
  uint8_t *t = static_cast<uint8_t*>(calloc(1, 8));

  t[0] = data[7];
  t[1] = data[6];
  t[2] = data[5];
  t[3] = data[4];
  t[4] = data[3];
  t[5] = data[2];
  t[6] = data[1];
  t[7] = data[0];

  double result = *reinterpret_cast<double*>(t);
  free(t);

  return result;
}

float getJavaFloat(char *data) {
  uint8_t *t = static_cast<uint8_t*>(calloc(1, 4));

  t[0] = data[3];
  t[1] = data[2];
  t[2] = data[1];
  t[3] = data[0];

  float result = *reinterpret_cast<float*>(t);
  free(t);

  return result;
}

void ProtocolParser::Initialize(Handle<Object> target) {
  HandleScope scope;

  Local<FunctionTemplate> t = FunctionTemplate::New(ProtocolParser::New);
  t->InstanceTemplate()->SetInternalFieldCount(1);
  t->SetClassName(String::NewSymbol("ProtocolParser"));

  NODE_SET_PROTOTYPE_METHOD(t, "parse", ProtocolParser::Parse);

  target->Set(String::NewSymbol("ProtocolParser"), t->GetFunction());
}

Handle<Value> ProtocolParser::New(const Arguments &args) {
  HandleScope scope;

  return args.This();
}

Handle<Value> ProtocolParser::Parse(const Arguments &args) {
  HandleScope scope;

  if (args.Length() < 1 || !Buffer::HasInstance(args[0])) {
    return ThrowException(Exception::Error(String::New(
            "First arguments should be a Buffer instance")));
  }

  Local<Object> buffer = args[0]->ToObject();
  char *data = Buffer::Data(buffer);
  size_t bytesLeft = Buffer::Length(buffer);

  // At least we should now a packet type
  if (bytesLeft < 1) return scope.Close(Number::New(0));

  Local<Array> results = Array::New();
  int resultIndex = 0;

  size_t bytesWaiting = 1;
  bool matched = false;

  do {
    Local<Object> result = Object::New();

    PacketType type = (PacketType) data[0];

    switch (type) {
      case KeepAlive:
        // 1 byte packet w/o data
        // ignore it
        bytesWaiting = 1;
        result->Set(String::New("type"), String::New("keepalive"));
        matched = true;
        break;
      case LoginRequest:
        {
          bytesWaiting = 6;
          if (bytesLeft < bytesWaiting) break;

          uint16_t usernameLength = (data[5] << 8) | data[6];

          bytesWaiting = 16 + usernameLength;
          if (bytesLeft < bytesWaiting) break;

          uint32_t protocolVersion = (data[1] << 24) |
                                     (data[2] << 16) |
                                     (data[3] << 8) |
                                     data[4];

          result->Set(String::New("type"),
                      String::New("loginRequest"));
          result->Set(String::New("protocolVersion"),
                      Number::New(protocolVersion));
          result->Set(String::New("username"),
                      getJavaString16(data + 7, usernameLength));

          matched = true;
        }
        break;
      case Handshake:
        {
          bytesWaiting = 3;
          if (bytesLeft < bytesWaiting) break;

          uint16_t usernameLength = (data[1] << 8) | data[2];

          bytesWaiting = 3 + usernameLength;
          if (bytesLeft < bytesWaiting) break;

          result->Set(String::New("type"),
                      String::New("handshake"));

          result->Set(String::New("username"),
                      getJavaString16(data + 3, usernameLength));

          matched = true;
        }
        break;
      case Player:
        bytesWaiting = 2;
        if (bytesLeft < bytesWaiting) break;

        result->Set(String::New("type"),
                    String::New("player"));
        result->Set(String::New("onGround"),
                    data[1] ? True() : False());
        matched = true;
        break;
      case PlayerPosition:
        {
          bytesWaiting = 34;
          if (bytesLeft < bytesWaiting) break;

          double x = getJavaDouble(data + 1);
          double y = getJavaDouble(data + 9);
          double stance = getJavaDouble(data + 17);
          double z = getJavaDouble(data + 25);
          bool onGround = data[33];

          result->Set(String::New("type"),
                      String::New("playerPosition"));
          result->Set(String::New("x"), Number::New(x));
          result->Set(String::New("y"), Number::New(y));
          result->Set(String::New("stance"), Number::New(stance));
          result->Set(String::New("z"), Number::New(z));
          result->Set(String::New("onGround"),
                      onGround ? True() : False());
          matched = true;
        }
        break;
      case PlayerLook:
        {
          bytesWaiting = 10;
          if (bytesLeft < bytesWaiting) break;

          float yaw = getJavaFloat(data + 1);
          float pitch = getJavaFloat(data + 5);
          bool onGround = data[9];

          result->Set(String::New("type"),
                      String::New("playerLook"));
          result->Set(String::New("yaw"), Number::New(yaw));
          result->Set(String::New("pitch"), Number::New(pitch));
          result->Set(String::New("onGround"),
                      onGround ? True() : False());
          matched = true;
        }
        break;
      case PlayerPositionAndLook:
        {
          bytesWaiting = 42;
          if (bytesLeft < bytesWaiting) break;

          double x = getJavaDouble(data + 1);
          double y = getJavaDouble(data + 9);
          double stance = getJavaDouble(data + 17);
          double z = getJavaDouble(data + 25);
          float yaw = getJavaFloat(data + 33);
          float pitch = getJavaFloat(data + 37);
          bool onGround = data[41];

          result->Set(String::New("type"),
                      String::New("playerPositionAndLook"));
          result->Set(String::New("x"), Number::New(x));
          result->Set(String::New("y"), Number::New(y));
          result->Set(String::New("stance"), Number::New(stance));
          result->Set(String::New("z"), Number::New(z));
          result->Set(String::New("yaw"), Number::New(yaw));
          result->Set(String::New("pitch"), Number::New(pitch));
          result->Set(String::New("onGround"),
                      onGround ? True() : False());
          matched = true;
        }
        break;
      case PlayerDigging:
        {
          bytesWaiting = 12;
          if (bytesLeft < bytesWaiting) break;

          char status = data[1];
          uint32_t x = (data[2] << 24) |
                       (data[3] << 16) |
                       (data[4] << 8) |
                       data[5];
          char y = data[6];
          uint32_t z = (data[7] << 24) |
                       (data[8] << 16) |
                       (data[9] << 8) |
                       data[10];
          char face = data[11];

          result->Set(String::New("type"), String::New("playerDigging"));
          result->Set(String::New("status"), Number::New(status));
          result->Set(String::New("x"), Number::New(x));
          result->Set(String::New("y"), Number::New(y));
          result->Set(String::New("z"), Number::New(z));
          result->Set(String::New("face"), Number::New(face));

          matched = true;
        }
        break;
      case Animation:
        {
          bytesWaiting = 6;
          if (bytesLeft < bytesWaiting) break;

          uint32_t eid = (data[1] << 24) |
                         (data[2] << 16) |
                         (data[3] << 8) |
                         data[4];
          char animate = data[5];

          result->Set(String::New("type"), String::New("animate"));
          result->Set(String::New("entityID"), Number::New(eid));
          result->Set(String::New("animate"), Number::New(animate));

          matched = true;
        }
        break;
      case Disconnect:
        {
          bytesWaiting = 3;
          if (bytesLeft < bytesWaiting) break;

          uint16_t reasonLength = (data[1] << 8) | data[2];

          bytesWaiting = 3 + reasonLength;
          if (bytesLeft < bytesWaiting) break;

          result->Set(String::New("type"),
                      String::New("disconnect"));
          result->Set(String::New("reason"),
                      getJavaString16(data + 3, reasonLength));

          matched = true;
        }
        break;
      default:
        bytesWaiting = 1;
        break;
    }

    // Move pointer if match found
    if (matched) {
      matched = false;

      results->Set(resultIndex++, result);

      bytesLeft -= bytesWaiting;
      data += bytesWaiting;

      bytesWaiting = 0;
    }
  } while (bytesWaiting == 0 && bytesLeft > 0);

  // Include `type` byte
  results->Set(String::New("bytesWaiting"),
               Number::New(bytesWaiting > 0 ? bytesWaiting + 1 : 0));
  results->Set(String::New("bytesLeft"),
               Number::New(bytesLeft));
  return scope.Close(results);
}

} // namespace craftjs
} // namespace node

NODE_MODULE(craftjs, node::craftjs::ProtocolParser::Initialize);
