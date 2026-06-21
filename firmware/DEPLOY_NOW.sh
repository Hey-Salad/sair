#!/bin/bash

# Sally Camera Firmware Deployment Script
# Flashes updated WebSocket firmware to DFRobot DFR1154 ESP32-S3

set -e

echo "🎥 Sally Camera Firmware - WebSocket Edition"
echo "=============================================="
echo ""

# Check if device is connected
if [ ! -e "/dev/cu.usbmodem1101" ]; then
    echo "❌ ESP32 device not found at /dev/cu.usbmodem1101"
    echo "Please connect your DFRobot DFR1154 via USB-C"
    exit 1
fi

echo "✅ Device found at /dev/cu.usbmodem1101"
echo ""

# Navigate to firmware directory
cd "$(dirname "$0")"

echo "📦 Building firmware..."
pio run

echo ""
echo "⚡ Uploading firmware to device..."
pio run --target upload

echo ""
echo "📊 Opening serial monitor..."
echo "Press Ctrl+C to exit monitor"
echo ""
sleep 2

pio device monitor
