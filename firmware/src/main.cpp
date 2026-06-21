/**
 * Sally AI Camera Firmware - Cloud-Native Edition
 * For DFRobot DFR1154 ESP32-S3 AI Camera (OV3660)
 *
 * Features:
 * - WebSocket streaming to Sally AI Camera API
 * - Cloud heartbeat (no USB bridge needed)
 * - OTA firmware updates via WebSocket command
 * - BLE onboarding (WiFi + cloud config from mobile app)
 * - Night vision IR LED control
 * - HTTP status endpoint
 */

#include "esp_camera.h"
#include "esp_http_server.h"
#include <WiFi.h>
#include "esp_ota_ops.h"
#include "esp_https_ota.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <HTTPClient.h>
#include <NimBLEDevice.h>
#include <Preferences.h>

// ==========================================
// VERSION
// ==========================================

#define FIRMWARE_VERSION "2.1.0"

// ==========================================
// CONFIGURATION
// ==========================================

// Sally AI Camera API (WebSocket streaming)
const char *SALLY_API_HOST = "sally-ai-camera-api.heysalad.app";
const char *SALLY_API_PATH = "/stream";

// Cloud heartbeat endpoint (replaces USB bridge)
const char *DEFAULT_HEARTBEAT_URL = "https://heysalad-os.vercel.app/api/vision/ingest/heartbeat";

// Edge inference endpoint (DETR object detection via Cloudflare Workers AI)
const char *DETECT_URL = "https://sally-api.heysalad.app/api/vision/detect";

// Optional fallback WiFi for lab flashing. Keep production credentials in BLE
// provisioning, NVS, or compile-time build flags, never in source control.
const char *DEFAULT_WIFI_SSID = "";
const char *DEFAULT_WIFI_PASS = "";

#ifndef PROVISION_WIFI_SSID
#define PROVISION_WIFI_SSID ""
#endif

#ifndef PROVISION_WIFI_PASS
#define PROVISION_WIFI_PASS ""
#endif

// BLE Configuration
#define SERVICE_UUID              "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define STATUS_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a9"

// Streaming Configuration
const int STREAM_FPS = 10;
const int FRAME_INTERVAL_MS = 1000 / STREAM_FPS;

// Heartbeat interval
const int HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

// ==========================================
// DFRobot DFR1154 GPIO PINS
// ==========================================

#define PWDN_GPIO_NUM   -1
#define RESET_GPIO_NUM  -1
#define XCLK_GPIO_NUM    5
#define SIOD_GPIO_NUM    8
#define SIOC_GPIO_NUM    9
#define Y9_GPIO_NUM      4
#define Y8_GPIO_NUM      6
#define Y7_GPIO_NUM      7
#define Y6_GPIO_NUM     14
#define Y5_GPIO_NUM     17
#define Y4_GPIO_NUM     21
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM     16
#define VSYNC_GPIO_NUM   1
#define HREF_GPIO_NUM    2
#define PCLK_GPIO_NUM   15

#define LED_PIN         3
#define IR_LED_PIN     47
#define BUTTON_PIN      0

// ==========================================
// GLOBALS
// ==========================================

// BLE
NimBLEServer *pServer = NULL;
NimBLECharacteristic *pCharacteristic = NULL;
NimBLECharacteristic *pStatusCharacteristic = NULL;

// OTP pairing
static char    otpCode[7]       = "";
static uint32_t otpExpiry       = 0;
static const uint32_t OTP_TTL_MS = 30000;

void generateOTP() {
  uint32_t r = esp_random() % 1000000;
  snprintf(otpCode, sizeof(otpCode), "%06lu", (unsigned long)r);
  otpExpiry = millis() + OTP_TTL_MS;
  Serial.printf("[OTP] Generated: %s (expires in %us)\n", otpCode, OTP_TTL_MS / 1000);
}

bool verifyOTP(const String &entered) {
  if (millis() > otpExpiry) return false;
  return entered.equals(String(otpCode));
}

bool deviceConnected = false;
bool oldDeviceConnected = false;

// WebSocket
WebSocketsClient wsClient;
bool wsConnected = false;
bool wsReconnecting = false;
unsigned long lastReconnectAttempt = 0;
const int WS_RECONNECT_INTERVAL = 5000;

// Settings
Preferences preferences;
String wifiSSID = "";
String wifiPassword = "";
String deviceId = "";
String deviceSecret = "";
String userId = "default-user";
String heartbeatUrl = "";
String heartbeatToken = "";

// State
bool isWiFiConnected = false;
bool nightVisionEnabled = false;
bool streamingEnabled = true;
bool otaInProgress = false;

// Timing
unsigned long lastFrameSent = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastStatusUpdate = 0;
unsigned long lastLedBlink = 0;
unsigned long lastHeartbeat = 0;
const int WIFI_CHECK_INTERVAL = 30000;
const int STATUS_UPDATE_INTERVAL = 5000;

// Stats
uint32_t framesSent = 0;
uint32_t framesDropped = 0;
uint32_t bytesSent = 0;

// Edge inference
bool edgeDetectionEnabled = true;
unsigned long lastEdgeDetect = 0;
int edgeDetectIntervalMs = 5000; // 5 seconds default
uint32_t edgeDetectCount = 0;

// HTTP server
httpd_handle_t status_httpd = NULL;

// ==========================================
// STATUS / LED HELPERS
// ==========================================

void setLED(bool state) {
  digitalWrite(LED_PIN, state ? HIGH : LOW);
}

void blinkLED(int times, int delayMs = 100) {
  for (int i = 0; i < times; i++) {
    setLED(true);
    delay(delayMs);
    setLED(false);
    delay(delayMs);
  }
}

void setNightVision(bool enabled) {
  nightVisionEnabled = enabled;
  digitalWrite(IR_LED_PIN, enabled ? HIGH : LOW);
  Serial.printf("Night vision: %s\n", enabled ? "ON" : "OFF");
}

void sendBLEStatus(const char *status) {
  Serial.printf("Status: %s\n", status);
  if (deviceConnected && pStatusCharacteristic) {
    pStatusCharacteristic->setValue(status);
    pStatusCharacteristic->notify();
  }
}

// ==========================================
// NVS STORAGE
// ==========================================

void loadSettings() {
  preferences.begin("sally-camera", false);
  wifiSSID       = preferences.getString("wifi_ssid", "");
  wifiPassword   = preferences.getString("wifi_pass", "");
  deviceSecret   = preferences.getString("device_secret", "");
  userId         = preferences.getString("user_id", "default-user");
  deviceId       = preferences.getString("device_id", "");
  heartbeatUrl   = preferences.getString("hb_url", "");
  heartbeatToken = preferences.getString("hb_token", "");
  preferences.end();

  // Default heartbeat URL
  if (heartbeatUrl.length() == 0) {
    heartbeatUrl = DEFAULT_HEARTBEAT_URL;
  }

  // Fallback to MAC address if no device_id stored
  if (deviceId.length() == 0) {
    deviceId = WiFi.macAddress();
    deviceId.replace(":", "");
    Serial.println("No device_id in NVS, using MAC address");
  }

  if (wifiSSID.length() > 0) {
    Serial.printf("WiFi loaded: %s\n", wifiSSID.c_str());
    Serial.printf("Device ID: %s\n", deviceId.c_str());
  } else {
    Serial.println("No WiFi credentials, using defaults");
    wifiSSID     = DEFAULT_WIFI_SSID;
    wifiPassword = DEFAULT_WIFI_PASS;
  }
}

void saveWiFiCredentials(String ssid, String password) {
  preferences.begin("sally-camera", false);
  preferences.putString("wifi_ssid", ssid);
  preferences.putString("wifi_pass", password);
  preferences.end();
  wifiSSID     = ssid;
  wifiPassword = password;
  Serial.println("WiFi credentials saved");
  sendBLEStatus("WIFI_SAVED");
}

void applyProvisionedWiFiCredentials() {
  const char *provisionedSSID = PROVISION_WIFI_SSID;
  const char *provisionedPass = PROVISION_WIFI_PASS;

  if (strlen(provisionedSSID) == 0) return;
  if (wifiSSID == String(provisionedSSID) && wifiPassword == String(provisionedPass)) return;

  Serial.println("Applying provisioned WiFi credentials");
  saveWiFiCredentials(String(provisionedSSID), String(provisionedPass));
}

void saveDeviceId(String id) {
  preferences.begin("sally-camera", false);
  preferences.putString("device_id", id);
  preferences.end();
  deviceId = id;
  Serial.printf("Device ID saved: %s\n", id.c_str());
}

void saveHeartbeatConfig(String url, String token) {
  preferences.begin("sally-camera", false);
  preferences.putString("hb_url", url);
  preferences.putString("hb_token", token);
  preferences.end();
  heartbeatUrl = url;
  heartbeatToken = token;
  Serial.printf("Heartbeat config saved: %s\n", url.c_str());
}

void saveUserId(String id) {
  preferences.begin("sally-camera", false);
  preferences.putString("user_id", id);
  preferences.end();
  userId = id;
  Serial.printf("User ID saved: %s\n", id.c_str());
}

// ==========================================
// WIFI
// ==========================================

bool connectWiFi(int timeoutSeconds = 20) {
  if (wifiSSID.length() == 0) {
    sendBLEStatus("WIFI_NO_SSID");
    return false;
  }

  Serial.printf("Connecting to WiFi: %s\n", wifiSSID.c_str());
  sendBLEStatus("WIFI_CONNECTING");
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < timeoutSeconds * 2) {
    delay(500);
    Serial.print(".");
    blinkLED(1, 50);
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    isWiFiConnected = true;
    Serial.printf("\nWiFi Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("RSSI: %d dBm\n", WiFi.RSSI());
    sendBLEStatus("WIFI_CONNECTED");
    blinkLED(3, 100);
    return true;
  }

  isWiFiConnected = false;
  Serial.println("\nWiFi Failed");
  sendBLEStatus("WIFI_FAILED");
  return false;
}

void maintainWiFi() {
  unsigned long now = millis();
  if (now - lastWiFiCheck < WIFI_CHECK_INTERVAL) return;
  lastWiFiCheck = now;

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting...");
    isWiFiConnected = false;
    wsConnected = false;
    connectWiFi(10);
  }
}

// ==========================================
// CLOUD HEARTBEAT (replaces USB bridge)
// ==========================================

void sendCloudHeartbeat() {
  if (!isWiFiConnected) return;

  unsigned long now = millis();
  if (now - lastHeartbeat < HEARTBEAT_INTERVAL_MS) return;
  lastHeartbeat = now;

  HTTPClient http;
  http.begin(heartbeatUrl);
  http.addHeader("Content-Type", "application/json");
  if (heartbeatToken.length() > 0) {
    http.addHeader("Authorization", "Bearer " + heartbeatToken);
  }

  // Build heartbeat JSON
  JsonDocument doc;
  doc["deviceId"] = deviceId;
  doc["temperatureC"] = temperatureRead();
  doc["signalDbm"] = WiFi.RSSI();
  doc["fps"] = (framesSent > 0 && millis() > 10000) ? (float)framesSent / (millis() / 1000.0) : 0;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["status"] = (wsConnected && streamingEnabled) ? "online" : "degraded";
  doc["recording"] = streamingEnabled;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  if (httpCode > 0) {
    Serial.printf("[Heartbeat] POST %d\n", httpCode);
  } else {
    Serial.printf("[Heartbeat] Failed: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

// ==========================================
// OTA FIRMWARE UPDATE
// ==========================================

void performOTA(const char* firmwareUrl) {
  if (otaInProgress) {
    Serial.println("[OTA] Already in progress");
    return;
  }

  otaInProgress = true;
  streamingEnabled = false;
  sendBLEStatus("OTA_STARTING");
  Serial.printf("[OTA] Downloading from: %s\n", firmwareUrl);

  HTTPClient http;
  http.begin(firmwareUrl);
  int httpCode = http.GET();

  if (httpCode != 200) {
    Serial.printf("[OTA] Download failed: %d\n", httpCode);
    sendBLEStatus("OTA_FAILED");
    otaInProgress = false;
    streamingEnabled = true;
    http.end();
    return;
  }

  int contentLength = http.getSize();
  if (contentLength <= 0) {
    Serial.println("[OTA] Invalid content length");
    sendBLEStatus("OTA_FAILED");
    otaInProgress = false;
    streamingEnabled = true;
    http.end();
    return;
  }

  Serial.printf("[OTA] Firmware size: %d bytes\n", contentLength);
  sendBLEStatus("OTA_DOWNLOADING");

  const esp_partition_t *updatePartition = esp_ota_get_next_update_partition(NULL);
  if (!updatePartition) {
    Serial.println("[OTA] No update partition found");
    sendBLEStatus("OTA_FAILED");
    otaInProgress = false;
    streamingEnabled = true;
    http.end();
    return;
  }

  esp_ota_handle_t otaHandle;
  esp_err_t err = esp_ota_begin(updatePartition, contentLength, &otaHandle);
  if (err != ESP_OK) {
    Serial.printf("[OTA] Begin failed: %s\n", esp_err_to_name(err));
    sendBLEStatus("OTA_FAILED");
    otaInProgress = false;
    streamingEnabled = true;
    http.end();
    return;
  }

  WiFiClient *stream = http.getStreamPtr();
  uint8_t buf[4096];
  int written = 0;
  int lastPercent = 0;

  while (http.connected() && written < contentLength) {
    size_t available = stream->available();
    if (available == 0) {
      delay(1);
      continue;
    }

    int bytesRead = stream->readBytes(buf, min(available, sizeof(buf)));
    err = esp_ota_write(otaHandle, buf, bytesRead);
    if (err != ESP_OK) {
      Serial.printf("[OTA] Write failed: %s\n", esp_err_to_name(err));
      esp_ota_abort(otaHandle);
      sendBLEStatus("OTA_FAILED");
      otaInProgress = false;
      streamingEnabled = true;
      http.end();
      return;
    }

    written += bytesRead;
    int percent = (written * 100) / contentLength;
    if (percent != lastPercent && percent % 10 == 0) {
      Serial.printf("[OTA] Progress: %d%%\n", percent);
      char statusBuf[32];
      snprintf(statusBuf, sizeof(statusBuf), "OTA_PROGRESS:%d", percent);
      sendBLEStatus(statusBuf);
      lastPercent = percent;
    }
  }

  http.end();

  err = esp_ota_end(otaHandle);
  if (err != ESP_OK) {
    Serial.printf("[OTA] End failed: %s\n", esp_err_to_name(err));
    sendBLEStatus("OTA_FAILED");
    otaInProgress = false;
    streamingEnabled = true;
    return;
  }

  err = esp_ota_set_boot_partition(updatePartition);
  if (err != ESP_OK) {
    Serial.printf("[OTA] Set boot partition failed: %s\n", esp_err_to_name(err));
    sendBLEStatus("OTA_FAILED");
    otaInProgress = false;
    streamingEnabled = true;
    return;
  }

  Serial.println("[OTA] Success! Rebooting...");
  sendBLEStatus("OTA_COMPLETE");
  delay(1000);
  esp_restart();
}

// ==========================================
// WEBSOCKET
// ==========================================

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      wsConnected = false;
      sendBLEStatus("WS_DISCONNECTED");
      break;

    case WStype_CONNECTED:
      Serial.println("WebSocket connected to Sally API");
      wsConnected = true;
      wsReconnecting = false;
      sendBLEStatus("WS_CONNECTED");
      blinkLED(2, 200);

      // Send hello with firmware version
      {
        JsonDocument hello;
        hello["type"] = "hello";
        hello["device_id"] = deviceId;
        hello["firmware"] = FIRMWARE_VERSION;
        hello["ip"] = WiFi.localIP().toString();
        hello["rssi"] = WiFi.RSSI();
        String helloStr;
        serializeJson(hello, helloStr);
        wsClient.sendTXT(helloStr);
      }
      break;

    case WStype_TEXT:
      {
        String data = String((char*)payload);
        Serial.printf("WS message: %s\n", data.c_str());

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, data);
        if (error) {
          Serial.printf("JSON parse error: %s\n", error.c_str());
          return;
        }

        const char* msgType = doc["type"];
        if (!msgType) return;

        if (strcmp(msgType, "control") == 0) {
          const char* command = doc["command"];
          if (command) {
            if (strcmp(command, "start_stream") == 0) {
              streamingEnabled = true;
            } else if (strcmp(command, "stop_stream") == 0) {
              streamingEnabled = false;
            } else if (strcmp(command, "night_vision_on") == 0) {
              setNightVision(true);
            } else if (strcmp(command, "night_vision_off") == 0) {
              setNightVision(false);
            } else if (strcmp(command, "capture") == 0) {
              lastFrameSent = 0;
            } else if (strcmp(command, "reboot") == 0) {
              sendBLEStatus("REBOOTING");
              delay(500);
              esp_restart();
            }
          }
        } else if (strcmp(msgType, "edge_detect") == 0) {
          // Control edge inference from viewer
          if (doc.containsKey("enabled")) {
            edgeDetectionEnabled = doc["enabled"].as<bool>();
            Serial.printf("Edge detection: %s\n", edgeDetectionEnabled ? "ON" : "OFF");
          }
          if (doc.containsKey("interval")) {
            edgeDetectIntervalMs = doc["interval"].as<int>();
            if (edgeDetectIntervalMs < 2000) edgeDetectIntervalMs = 2000;
            Serial.printf("Edge detection interval: %dms\n", edgeDetectIntervalMs);
          }
        } else if (strcmp(msgType, "ota") == 0) {
          const char* url = doc["url"];
          if (url) {
            performOTA(url);
          }
        } else if (strcmp(msgType, "error") == 0) {
          const char* message = doc["message"];
          Serial.printf("Server error: %s\n", message ? message : "unknown");
        }
      }
      break;

    case WStype_BIN:
      break;
    case WStype_PING:
    case WStype_PONG:
      break;
    case WStype_ERROR:
      Serial.printf("WebSocket error: %s\n", payload);
      break;
    default:
      break;
  }
}

bool connectWebSocket() {
  if (!isWiFiConnected) return false;
  if (wsReconnecting) return false;
  wsReconnecting = true;

  sendBLEStatus("WS_CONNECTING");

  String path = SALLY_API_PATH;
  path += "/";
  path += deviceId;
  path += "?role=camera";

  Serial.printf("Connecting to wss://%s%s\n", SALLY_API_HOST, path.c_str());

  wsClient.onEvent(webSocketEvent);
  wsClient.setReconnectInterval(5000);
  wsClient.beginSSL(SALLY_API_HOST, 443, path);

  Serial.println("WebSocket connection initiated");
  wsReconnecting = false;
  return true;
}

void maintainWebSocket() {
  if (!isWiFiConnected) return;
  wsClient.loop();

  if (!wsClient.isConnected() && wsConnected) {
    wsConnected = false;
  }
}

// ==========================================
// EDGE INFERENCE (Cloud DETR via Workers AI)
// ==========================================

void performEdgeDetection() {
  if (!isWiFiConnected || !edgeDetectionEnabled || otaInProgress) return;

  unsigned long now = millis();
  if (now - lastEdgeDetect < (unsigned long)edgeDetectIntervalMs) return;
  lastEdgeDetect = now;

  // Capture a frame for detection
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[EdgeAI] Frame capture failed");
    return;
  }

  Serial.printf("[EdgeAI] Sending %u bytes for detection...\n", fb->len);

  HTTPClient http;
  http.begin(DETECT_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.setTimeout(10000);

  int httpCode = http.POST(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  if (httpCode != 200) {
    Serial.printf("[EdgeAI] HTTP %d\n", httpCode);
    http.end();
    return;
  }

  String response = http.getString();
  http.end();

  // Parse DETR response
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, response);
  if (error) {
    Serial.printf("[EdgeAI] JSON parse error: %s\n", error.c_str());
    return;
  }

  if (!doc["ok"].as<bool>()) {
    Serial.printf("[EdgeAI] Detection error: %s\n", doc["error"].as<const char*>());
    return;
  }

  edgeDetectCount++;
  JsonArray detections = doc["detections"].as<JsonArray>();
  int count = detections.size();
  Serial.printf("[EdgeAI] #%u: %d objects detected\n", edgeDetectCount, count);

  // Forward detections to all viewers via WebSocket
  if (wsConnected && count > 0) {
    JsonDocument outDoc;
    outDoc["type"] = "edge_detections";
    outDoc["count"] = count;
    outDoc["detection_id"] = edgeDetectCount;
    outDoc["timestamp"] = millis();

    JsonArray outArr = outDoc["detections"].to<JsonArray>();
    for (JsonObject det : detections) {
      JsonObject out = outArr.add<JsonObject>();
      out["label"] = det["label"];
      out["score"] = det["score"];
      JsonObject box = out["box"].to<JsonObject>();
      box["xmin"] = det["box"]["xmin"];
      box["ymin"] = det["box"]["ymin"];
      box["xmax"] = det["box"]["xmax"];
      box["ymax"] = det["box"]["ymax"];
    }

    String outStr;
    serializeJson(outDoc, outStr);
    wsClient.sendTXT(outStr);
    Serial.printf("[EdgeAI] Sent %d detections to viewers\n", count);
  }
}

// ==========================================
// FRAME STREAMING
// ==========================================

void streamFrame() {
  if (!wsConnected || !streamingEnabled || otaInProgress) return;

  unsigned long now = millis();
  if (now - lastFrameSent < FRAME_INTERVAL_MS) return;

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    framesDropped++;
    return;
  }

  bool sent = wsClient.sendBIN(fb->buf, fb->len);

  if (sent) {
    framesSent++;
    bytesSent += fb->len;
    lastFrameSent = now;

    if (now - lastLedBlink > 1000) {
      setLED(true);
      lastLedBlink = now;
    } else {
      setLED(false);
    }

    if (framesSent % 100 == 0) {
      Serial.printf("Stats: %d frames, %d KB sent\n", framesSent, bytesSent / 1024);
    }
  } else {
    framesDropped++;
  }

  esp_camera_fb_return(fb);
}

// ==========================================
// HTTP SERVER
// ==========================================

esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=frame");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) { res = ESP_FAIL; break; }
    if (fb->format != PIXFORMAT_JPEG) { esp_camera_fb_return(fb); continue; }

    size_t hlen = snprintf(part_buf, sizeof(part_buf),
      "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n", fb->len);

    res = httpd_resp_send_chunk(req, part_buf, hlen);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, "\r\n", 2);

    esp_camera_fb_return(fb);
    if (res != ESP_OK) break;
    delay(100);
  }
  return res;
}

esp_err_t status_handler(httpd_req_t *req) {
  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["wifi"] = isWiFiConnected ? "connected" : "disconnected";
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["websocket"] = wsConnected ? "connected" : "disconnected";
  doc["streaming"] = streamingEnabled;
  doc["night_vision"] = nightVisionEnabled;
  doc["frames_sent"] = framesSent;
  doc["frames_dropped"] = framesDropped;
  doc["bytes_sent"] = bytesSent;
  doc["uptime_sec"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["free_psram"] = ESP.getFreePsram();
  doc["ota_in_progress"] = otaInProgress;

  String json;
  serializeJson(doc, json);

  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_send(req, json.c_str(), json.length());
  return ESP_OK;
}

void startStatusServer() {
  if (status_httpd) return;

  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.max_open_sockets = 3;
  config.lru_purge_enable = true;

  httpd_uri_t status_uri = { "/", HTTP_GET, status_handler, NULL };
  httpd_uri_t stream_uri = { "/stream", HTTP_GET, stream_handler, NULL };

  if (httpd_start(&status_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(status_httpd, &status_uri);
    httpd_register_uri_handler(status_httpd, &stream_uri);
    Serial.printf("HTTP server: http://%s/\n", WiFi.localIP().toString().c_str());
  }
}

// ==========================================
// BLE CALLBACKS
// ==========================================

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer *pSrv) override {
    deviceConnected = true;
    Serial.println("BLE client connected");
  }
  void onDisconnect(NimBLEServer *pSrv) override {
    deviceConnected = false;
    Serial.println("BLE client disconnected");
  }
};

// Build full device info JSON for BLE
String getDeviceInfoJson() {
  JsonDocument doc;
  doc["device_id"] = deviceId;
  doc["firmware"] = FIRMWARE_VERSION;
  doc["wifi_connected"] = isWiFiConnected;
  doc["wifi_ssid"] = wifiSSID;
  doc["ip"] = isWiFiConnected ? WiFi.localIP().toString() : "";
  doc["rssi"] = isWiFiConnected ? WiFi.RSSI() : 0;
  doc["ws_connected"] = wsConnected;
  doc["streaming"] = streamingEnabled;
  doc["night_vision"] = nightVisionEnabled;
  doc["frames_sent"] = framesSent;
  doc["uptime_sec"] = millis() / 1000;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["cloud_heartbeat"] = heartbeatUrl.length() > 0;

  String json;
  serializeJson(doc, json);
  return json;
}

class CharCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *pChar) override {
    std::string val = pChar->getValue();
    if (val.empty()) return;

    String cmd = String(val.c_str());
    Serial.printf("BLE cmd: %s\n", cmd.c_str());

    // --- Simple commands ---

    if (cmd == "VERSION") {
      sendBLEStatus(("VERSION:" + String(FIRMWARE_VERSION)).c_str());

    } else if (cmd == "DEVICE_INFO") {
      // Full device status as JSON
      String info = getDeviceInfoJson();
      sendBLEStatus(info.c_str());

    } else if (cmd == "CAPTURE" || cmd == "capture") {
      lastFrameSent = 0;
      sendBLEStatus("CAPTURE_REQUESTED");

    } else if (cmd == "STREAM_START" || cmd == "stream_start") {
      streamingEnabled = true;
      sendBLEStatus("STREAM_STARTED");

    } else if (cmd == "STREAM_STOP" || cmd == "stream_stop") {
      streamingEnabled = false;
      sendBLEStatus("STREAM_STOPPED");

    } else if (cmd == "NIGHT_ON" || cmd == "night_on") {
      setNightVision(true);
      sendBLEStatus("NIGHT_ON");

    } else if (cmd == "NIGHT_OFF" || cmd == "night_off") {
      setNightVision(false);
      sendBLEStatus("NIGHT_OFF");

    } else if (cmd == "WIFI_STATUS" || cmd == "wifi_status") {
      if (isWiFiConnected) {
        String s = "WIFI_CONNECTED:" + WiFi.localIP().toString() + ":" + String(WiFi.RSSI());
        sendBLEStatus(s.c_str());
      } else {
        sendBLEStatus("WIFI_DISCONNECTED");
      }

    } else if (cmd == "WS_STATUS" || cmd == "ws_status") {
      sendBLEStatus(wsConnected ? "WS_CONNECTED" : "WS_DISCONNECTED");

    } else if (cmd == "STATUS" || cmd == "status") {
      String status = String("WIFI:") + (isWiFiConnected ? "1" : "0") +
                     "|WS:" + (wsConnected ? "1" : "0") +
                     "|STREAM:" + (streamingEnabled ? "1" : "0") +
                     "|FRAMES:" + String(framesSent) +
                     "|FW:" + FIRMWARE_VERSION;
      sendBLEStatus(status.c_str());

    } else if (cmd == "REBOOT") {
      sendBLEStatus("REBOOTING");
      delay(500);
      esp_restart();

    } else if (cmd == "FACTORY_RESET") {
      preferences.begin("sally-camera", false);
      preferences.clear();
      preferences.end();
      sendBLEStatus("FACTORY_RESET_DONE");
      delay(500);
      esp_restart();

    // --- OTP pairing ---

    } else if (cmd == "OTP_REQUEST" || cmd == "otp_request") {
      generateOTP();
      String reply = String("OTP:") + otpCode;
      sendBLEStatus(reply.c_str());

    } else if (cmd.startsWith("OTP_VERIFY:")) {
      String entered = cmd.substring(11);
      entered.trim();
      if (millis() > otpExpiry) {
        sendBLEStatus("OTP_EXPIRED");
        memset(otpCode, 0, sizeof(otpCode));
      } else if (verifyOTP(entered)) {
        sendBLEStatus("OTP_OK");
        memset(otpCode, 0, sizeof(otpCode));
      } else {
        sendBLEStatus("OTP_FAIL");
      }

    // --- Configuration commands ---

    } else if (cmd.startsWith("DEVICE_ID:")) {
      deviceId = cmd.substring(10);
      saveDeviceId(deviceId);
      sendBLEStatus(("DEVICE_ID_SET:" + deviceId).c_str());
      // Reconnect WebSocket with new device ID
      if (wsConnected) {
        wsClient.disconnect();
        wsConnected = false;
      }

    } else if (cmd.startsWith("USER_ID:")) {
      saveUserId(cmd.substring(8));
      sendBLEStatus("USER_ID_SET");

    } else if (cmd.startsWith("HEARTBEAT_URL:")) {
      // Format: HEARTBEAT_URL:https://...
      heartbeatUrl = cmd.substring(14);
      preferences.begin("sally-camera", false);
      preferences.putString("hb_url", heartbeatUrl);
      preferences.end();
      sendBLEStatus("HEARTBEAT_URL_SET");

    } else if (cmd.startsWith("HEARTBEAT_TOKEN:")) {
      heartbeatToken = cmd.substring(16);
      preferences.begin("sally-camera", false);
      preferences.putString("hb_token", heartbeatToken);
      preferences.end();
      sendBLEStatus("HEARTBEAT_TOKEN_SET");

    // --- Full provisioning: single BLE command for complete setup ---
    // Format: PROVISION:ssid|password|deviceId|userId|heartbeatToken
    } else if (cmd.startsWith("PROVISION:")) {
      String payload = cmd.substring(10);
      int sep1 = payload.indexOf('|');
      int sep2 = payload.indexOf('|', sep1 + 1);
      int sep3 = payload.indexOf('|', sep2 + 1);
      int sep4 = payload.indexOf('|', sep3 + 1);

      if (sep1 > 0 && sep2 > sep1) {
        String ssid = payload.substring(0, sep1);
        String pass = payload.substring(sep1 + 1, sep2);
        String newDeviceId = (sep2 < sep3) ? payload.substring(sep2 + 1, sep3) : "";
        String newUserId = (sep3 > 0 && sep3 < sep4) ? payload.substring(sep3 + 1, sep4) : "";
        String newToken = (sep4 > 0) ? payload.substring(sep4 + 1) : "";

        sendBLEStatus("PROVISION_START");

        // Save device ID if provided
        if (newDeviceId.length() > 0) {
          saveDeviceId(newDeviceId);
        }

        // Save user ID if provided
        if (newUserId.length() > 0) {
          saveUserId(newUserId);
        }

        // Save heartbeat token if provided
        if (newToken.length() > 0) {
          saveHeartbeatConfig(heartbeatUrl, newToken);
        }

        // Save WiFi and connect
        saveWiFiCredentials(ssid, pass);
        WiFi.disconnect();
        delay(1000);

        if (connectWiFi()) {
          startStatusServer();
          connectWebSocket();
          // Send immediate heartbeat
          lastHeartbeat = 0;
          sendCloudHeartbeat();
          sendBLEStatus("PROVISION_OK");
        } else {
          sendBLEStatus("PROVISION_WIFI_FAILED");
        }
      } else {
        sendBLEStatus("PROVISION_BAD_FORMAT");
      }

    // --- Legacy WiFi config commands ---

    } else if (cmd.startsWith("WIFI_CONFIG:")) {
      int sep = cmd.indexOf(':', 12);
      if (sep > 0) {
        String ssid = cmd.substring(12, sep);
        String pass = cmd.substring(sep + 1);
        saveWiFiCredentials(ssid, pass);
        WiFi.disconnect();
        delay(1000);
        if (connectWiFi()) {
          startStatusServer();
          connectWebSocket();
        }
      }

    } else if (cmd.startsWith("WIFI_SSID:")) {
      int newlineIndex = cmd.indexOf('\n');
      if (newlineIndex > 10) {
        String ssid = cmd.substring(10, newlineIndex);
        String passwordLine = cmd.substring(newlineIndex + 1);
        if (passwordLine.startsWith("WIFI_PASS:")) {
          String pass = passwordLine.substring(10);
          saveWiFiCredentials(ssid, pass);
          WiFi.disconnect();
          delay(1000);
          if (connectWiFi()) {
            startStatusServer();
            connectWebSocket();
          }
        }
      }

    // --- OTA via BLE ---
    } else if (cmd.startsWith("OTA:")) {
      String url = cmd.substring(4);
      performOTA(url.c_str());
    }
  }
};

// ==========================================
// CAMERA INIT
// ==========================================

bool initCamera() {
  Serial.println("Initializing camera...");

  if (psramFound()) {
    Serial.printf("PSRAM: %d bytes free\n", ESP.getFreePsram());
  } else {
    Serial.println("WARNING: PSRAM not detected!");
  }

  camera_config_t config;
  config.ledc_channel  = LEDC_CHANNEL_0;
  config.ledc_timer    = LEDC_TIMER_0;
  config.pin_d0        = Y2_GPIO_NUM;
  config.pin_d1        = Y3_GPIO_NUM;
  config.pin_d2        = Y4_GPIO_NUM;
  config.pin_d3        = Y5_GPIO_NUM;
  config.pin_d4        = Y6_GPIO_NUM;
  config.pin_d5        = Y7_GPIO_NUM;
  config.pin_d6        = Y8_GPIO_NUM;
  config.pin_d7        = Y9_GPIO_NUM;
  config.pin_xclk      = XCLK_GPIO_NUM;
  config.pin_pclk      = PCLK_GPIO_NUM;
  config.pin_vsync     = VSYNC_GPIO_NUM;
  config.pin_href      = HREF_GPIO_NUM;
  config.pin_sccb_sda  = SIOD_GPIO_NUM;
  config.pin_sccb_scl  = SIOC_GPIO_NUM;
  config.pin_pwdn      = PWDN_GPIO_NUM;
  config.pin_reset     = RESET_GPIO_NUM;
  config.xclk_freq_hz  = 20000000;
  config.pixel_format  = PIXFORMAT_JPEG;
  config.grab_mode     = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location   = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality  = 12;
  config.fb_count      = 2;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init FAILED: 0x%x\n", err);
    sendBLEStatus("CAMERA_FAILED");
    return false;
  }

  Serial.println("Camera initialized");

  sensor_t *s = esp_camera_sensor_get();
  if (s && s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);
    s->set_brightness(s, 1);
    s->set_saturation(s, -2);
  }

  sendBLEStatus("CAMERA_READY");
  return true;
}

// ==========================================
// SETUP
// ==========================================

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n========================================");
  Serial.printf("Sally AI Camera v%s\n", FIRMWARE_VERSION);
  Serial.println("========================================");

  // GPIO
  pinMode(LED_PIN, OUTPUT);
  pinMode(IR_LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  setLED(true);
  digitalWrite(IR_LED_PIN, LOW);

  // Load settings
  loadSettings();
  applyProvisionedWiFiCredentials();

  // BLE init
  NimBLEDevice::init("Sally by HeySalad");
  pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  NimBLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::NOTIFY);
  pCharacteristic->setCallbacks(new CharCallbacks());

  pStatusCharacteristic = pService->createCharacteristic(
      STATUS_CHARACTERISTIC_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);

  pService->start();
  NimBLEAdvertising *pAdv = NimBLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->start();
  Serial.println("BLE advertising started");

  // Camera init
  delay(500);
  if (!initCamera()) {
    Serial.println("Camera failed but continuing with BLE");
  }

  // WiFi
  if (connectWiFi()) {
    startStatusServer();
    connectWebSocket();
    setLED(false);
  } else {
    Serial.println("WiFi failed - BLE still available for setup");
    blinkLED(5, 100);
  }

  Serial.println("========================================");
  Serial.printf("Device ID: %s\n", deviceId.c_str());
  Serial.printf("Firmware:  v%s\n", FIRMWARE_VERSION);
  if (isWiFiConnected) {
    Serial.printf("IP:        %s\n", WiFi.localIP().toString().c_str());
  }
  Serial.println("========================================");
  sendBLEStatus("READY");
}

// ==========================================
// LOOP
// ==========================================

void loop() {
  unsigned long now = millis();

  // Skip normal operations during OTA
  if (otaInProgress) {
    delay(100);
    return;
  }

  // Maintain connections
  maintainWiFi();
  maintainWebSocket();

  // Stream frames
  if (wsConnected && streamingEnabled) {
    streamFrame();
  }

  // Edge inference (DETR object detection)
  performEdgeDetection();

  // Cloud heartbeat (replaces USB bridge entirely)
  sendCloudHeartbeat();

  // BLE status updates
  if (now - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
    lastStatusUpdate = now;
    if (deviceConnected) {
      String status = String("F:") + String(framesSent) +
                     "|D:" + String(framesDropped) +
                     "|B:" + String(bytesSent / 1024) + "K";
      sendBLEStatus(status.c_str());
    }
  }

  // Physical button - toggle streaming
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50);
    if (digitalRead(BUTTON_PIN) == LOW) {
      streamingEnabled = !streamingEnabled;
      Serial.printf("Streaming %s via button\n", streamingEnabled ? "enabled" : "disabled");
      blinkLED(3, 100);
      delay(1000);
    }
  }

  // BLE connection management
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(10);
}
