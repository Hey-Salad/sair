# Sally AI Camera Firmware - WebSocket Edition

ESP32-S3 camera firmware that streams to Sally AI Camera API via WebSocket.

## 🚀 What's New

**WebSocket Streaming**: Camera now connects directly to `wss://sally-ai-camera-api.heysalad.app` and streams frames in real-time.

### Changes from Previous Version

| Feature | Old (HTTP) | New (WebSocket) |
|---------|------------|-----------------|
| Streaming | HTTP MJPEG on `:81` | WebSocket binary frames |
| FPS | Variable | 10 FPS (configurable) |
| Connection | Viewers pull from device | Device pushes to Sally API |
| Commands | HTTP POST | WebSocket JSON |
| Recording | Not supported | Server-side recording |
| AI Analysis | Not supported | Server-side Claude vision |

## 🔧 Hardware

**DFRobot DFR1154 ESP32-S3 AI Camera**
- ESP32-S3 with 16MB Flash, 8MB OPI PSRAM
- OV3660 camera sensor (3MP)
- IR LED for night vision (GPIO 47)
- Status LED (GPIO 3)
- BOOT button (GPIO 0)

## 📦 Features

✅ **WebSocket Streaming** - Binary JPEG frames at 10 FPS
✅ **Auto-reconnection** - Handles WiFi and WebSocket disconnects
✅ **BLE Configuration** - WiFi setup and control via Bluetooth
✅ **Night Vision** - IR LED control
✅ **HTTP Status** - Debug endpoint on port 80
✅ **Frame Statistics** - Track frames sent, dropped, bandwidth

## 🔌 Quick Start

### 1. Install PlatformIO

```bash
# Install PlatformIO Core
pip install platformio

# Or use VSCode extension
# https://platformio.org/install/ide?install=vscode
```

### 2. Build & Upload

```bash
cd sally-camera-firmware

# Build firmware
pio run

# Upload to device (auto-detects port)
pio run -t upload

# Monitor serial output
pio device monitor
```

### 3. Configure WiFi

#### Option A: Edit Default Credentials (Quick)

Edit `src/main.cpp` lines 34-35:

```cpp
const char *DEFAULT_WIFI_SSID = "YourWiFiSSID";
const char *DEFAULT_WIFI_PASS = "YourWiFiPassword";
```

Then rebuild and upload.

#### Option B: Configure via BLE (Recommended)

1. Device creates BLE peripheral: `Sally by HeySalad`
2. Connect with mobile app or BLE tool
3. Send command: `WIFI_CONFIG:YourSSID:YourPassword`
4. Device saves credentials and reconnects

### 4. Verify Connection

Open `http://[device-ip]/` to see status JSON:

```json
{
  "device_id": "A0B1C2D3E4F5",
  "wifi": "connected",
  "ip": "192.168.1.180",
  "rssi": -45,
  "websocket": "connected",
  "streaming": true,
  "night_vision": false,
  "frames_sent": 1523,
  "frames_dropped": 3,
  "bytes_sent": 45236800,
  "uptime_sec": 1843,
  "free_heap": 234560,
  "free_psram": 7234560
}
```

## 🎛️ Configuration

### Streaming Settings

Edit `src/main.cpp` lines 43-45:

```cpp
const int STREAM_FPS = 10;                        // Target FPS (5-15 recommended)
const int FRAME_INTERVAL_MS = 1000 / STREAM_FPS; // Auto-calculated
```

### Sally API Endpoint

Edit `src/main.cpp` line 31:

```cpp
const char *SALLY_API_HOST = "sally-ai-camera-api.heysalad.app";
```

### Device ID

Device ID is auto-generated from MAC address on first boot. To set a custom ID:

**Via BLE**: Send `DEVICE_ID:your-custom-id-here`

**Via NVS**: Device stores ID in non-volatile storage after first BLE pairing.

## 🎮 BLE Commands

Connect to `Sally by HeySalad` and write to characteristic `beb5483e-36e1-4688-b7f5-ea07361b26a8`:

| Command | Description |
|---------|-------------|
| `WIFI_CONFIG:SSID:PASSWORD` | Set WiFi credentials and reconnect |
| `DEVICE_ID:abc123` | Set custom device ID |
| `STREAM_START` | Enable frame streaming |
| `STREAM_STOP` | Disable frame streaming |
| `NIGHT_ON` | Enable IR LED night vision |
| `NIGHT_OFF` | Disable night vision |
| `CAPTURE` | Force immediate frame capture |
| `WIFI_STATUS` | Get WiFi connection status |
| `WS_STATUS` | Get WebSocket connection status |
| `STATUS` | Get full device status |

**Status notifications** are sent to characteristic `beb5483e-36e1-4688-b7f5-ea07361b26a9`.

## 🔍 Troubleshooting

### Camera Won't Boot / Boot Loop

**Symptoms**: Device resets repeatedly, serial shows "Camera init FAILED"

**Fixes**:
1. Check PSRAM is enabled in `platformio.ini`:
   ```ini
   board_build.arduino.memory_type = qio_opi
   board_build.psram_type = opi
   ```
2. Try lower resolution in `src/main.cpp` line 645:
   ```cpp
   config.frame_size = FRAMESIZE_QVGA;  // 320x240
   ```
3. Reduce frame buffers (line 647):
   ```cpp
   config.fb_count = 1;
   ```

### WiFi Won't Connect

1. Check credentials in `src/main.cpp` or via BLE
2. Verify 2.4GHz WiFi (ESP32 doesn't support 5GHz)
3. Check serial monitor for error messages
4. Device will continue with BLE if WiFi fails

### WebSocket Won't Connect

1. Verify WiFi is connected first
2. Check device ID is set (defaults to MAC address)
3. Ensure Sally API is reachable:
   ```bash
   curl https://sally-ai-camera-api.heysalad.app/health
   ```
4. Check WebSocket URL in serial logs

### No Frames Being Sent

1. Check `streamingEnabled` in status endpoint
2. Press BOOT button to toggle streaming
3. Send BLE command: `STREAM_START`
4. Verify WebSocket is connected
5. Check free heap/PSRAM in status (may be memory exhausted)

### Low FPS / Frame Drops

1. Reduce `STREAM_FPS` (line 44 in main.cpp)
2. Lower JPEG quality (line 640):
   ```cpp
   config.jpeg_quality = 15;  // Higher = more compression
   ```
3. Check WiFi RSSI in status endpoint (< -70 dBm is weak)
4. Reduce resolution to QVGA

## 📊 Performance

**Typical Performance (VGA, Quality 12)**:
- FPS: 10 (stable)
- Frame size: 25-35 KB
- Bandwidth: 250-350 KB/s
- Memory: 200 KB heap, 7 MB PSRAM free
- Power: ~500 mA @ 5V

**Low-power Mode (QVGA, Quality 15)**:
- FPS: 5
- Frame size: 8-12 KB
- Bandwidth: 40-60 KB/s
- Power: ~350 mA @ 5V

## 🔧 Development

### Serial Monitor

```bash
pio device monitor

# Or with filters
pio device monitor -f esp32_exception_decoder
```

### OTA Updates

Not currently supported. Use USB for firmware updates.

### Custom Commands

Add new commands in `CharCallbacks::onWrite()` (line 522):

```cpp
} else if (cmd == "MY_COMMAND") {
  // Your code here
  sendBLEStatus("MY_RESPONSE");
}
```

## 📱 Mobile App Integration

Mobile app connects to Sally API as `role=viewer`:

```javascript
const ws = new WebSocket(
  'wss://sally-ai-camera-api.heysalad.app/stream/device-id-here?role=viewer'
);

ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // Binary JPEG frame
    displayFrame(event.data);
  } else {
    // JSON status/analysis
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  }
};
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│ ESP32-S3 Camera (sally-camera-firmware)                 │
│  - Captures frames from OV3660                          │
│  - Connects to Sally API via WebSocket (role=camera)   │
│  - Sends binary JPEG frames at 10 FPS                   │
│  - Receives JSON commands                               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ WSS (TLS)
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Sally AI Camera API (Cloudflare Workers)                │
│  - Receives frames from cameras                         │
│  - Broadcasts to viewers                                │
│  - AI vision analysis (Claude Sonnet 4.5)               │
│  - Recording to R2                                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ WSS (TLS)
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Mobile App / Web Viewer (role=viewer)                   │
│  - Receives frames                                       │
│  - Requests AI analysis                                  │
│  - Controls recording                                    │
└─────────────────────────────────────────────────────────┘
```

## 📄 License

**PROPRIETARY SOFTWARE**

Copyright © 2025 HeySalad Payments Ltd. All rights reserved.
Author: Peter Machona

This software is proprietary and confidential.

HeySalad Payments Ltd
3rd Floor, 86-90 Paul Street, London, England, EC2A 4NE

---

**Built with ❤️ for HeySalad Platform**
