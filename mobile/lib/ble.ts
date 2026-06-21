import { Platform } from 'react-native';

/**
 * Sally device BLE constants (from firmware spec).
 */
export const SALLY_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const WIFI_CONFIG_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const STATUS_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';

export interface ScannedDevice {
  id: string;
  name: string;
  /** signal strength in dBm (more negative = weaker) */
  rssi: number;
}

export type ConnectStatus = 'connecting' | 'connected' | 'error';

/**
 * BLE provisioning service.
 *
 * Web Bluetooth is used when available (secure context + supported browser).
 * On native a dev build with `react-native-ble-plx` is required; until that
 * native module is wired up we provide a faithful simulation so the full
 * setup UX is functional in the managed/preview runtime.
 *
 * NOTE (native): wire `react-native-ble-plx` here in a custom dev build:
 *   - manager.startDeviceScan([SALLY_SERVICE_UUID], ...) -> onDeviceFound
 *   - device.connect() + discoverAllServicesAndCharacteristics()
 *   - writeCharacteristicWithResponseForService(SALLY_SERVICE_UUID, WIFI_CONFIG_CHAR_UUID, base64(json))
 *   - readCharacteristicForService(SALLY_SERVICE_UUID, STATUS_CHAR_UUID)
 */
class BleService {
  private webDevice: BluetoothDevice | null = null;
  private webChar: BluetoothRemoteGATTCharacteristic | null = null;
  private statusChar: BluetoothRemoteGATTCharacteristic | null = null;

  get supportsRealBle(): boolean {
    return Platform.OS === 'web' && typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  /**
   * Scan for Sally devices. Web Bluetooth requires a user gesture and returns
   * a single chosen device. The simulated path streams a few mock devices.
   */
  async scan(onFound: (device: ScannedDevice) => void): Promise<void> {
    if (this.supportsRealBle) {
      try {
        const dev = await navigator.bluetooth.requestDevice({
          filters: [{ services: [SALLY_SERVICE_UUID] }],
          optionalServices: [SALLY_SERVICE_UUID],
        });
        this.webDevice = dev;
        onFound({ id: dev.id, name: dev.name ?? 'Sally Device', rssi: -52 });
        return;
      } catch {
        // user cancelled or unsupported filter -> fall through to simulation
      }
    }
    await this.simulateScan(onFound);
  }

  private async simulateScan(onFound: (device: ScannedDevice) => void): Promise<void> {
    const mock: ScannedDevice[] = [
      { id: 'CCBA9716248C', name: 'Sally-248C', rssi: -47 },
      { id: 'A4CF12B83D90', name: 'Sally-3D90', rssi: -68 },
    ];
    for (const d of mock) {
      await delay(900);
      onFound(d);
    }
  }

  /** Connect + write wifi creds + read status. Returns the resulting status text. */
  async provision(
    deviceId: string,
    ssid: string,
    password: string,
    onStatus: (status: ConnectStatus, message?: string) => void,
  ): Promise<{ status: ConnectStatus; deviceId: string }> {
    onStatus('connecting');
    if (this.supportsRealBle && this.webDevice) {
      try {
        const server = await this.webDevice.gatt?.connect();
        const service = await server?.getPrimaryService(SALLY_SERVICE_UUID);
        this.webChar = (await service?.getCharacteristic(WIFI_CONFIG_CHAR_UUID)) ?? null;
        this.statusChar = (await service?.getCharacteristic(STATUS_CHAR_UUID)) ?? null;
        const payload = JSON.stringify({ command: 'WIFI_CONFIG', ssid, password });
        await this.webChar?.writeValue(new TextEncoder().encode(payload));
        await delay(1500);
        const value = await this.statusChar?.readValue();
        const text = value ? new TextDecoder().decode(value) : '';
        const ok = !text || /connect/i.test(text);
        onStatus(ok ? 'connected' : 'error', text);
        return { status: ok ? 'connected' : 'error', deviceId: this.webDevice.id };
      } catch (e) {
        onStatus('error', e instanceof Error ? e.message : String(e));
        return { status: 'error', deviceId };
      }
    }
    // Simulated provisioning.
    await delay(2200);
    onStatus('connected');
    return { status: 'connected', deviceId };
  }

  disconnect(): void {
    try {
      this.webDevice?.gatt?.disconnect();
    } catch {
      // noop
    }
    this.webDevice = null;
    this.webChar = null;
    this.statusChar = null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const ble = new BleService();
