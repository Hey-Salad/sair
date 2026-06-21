declare module '*.css';

// Minimal Web Bluetooth typings (only what lib/ble.ts uses).
interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
  readValue(): Promise<DataView>;
}
interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}
interface BluetoothRemoteGATTServer {
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}
interface BluetoothGATT {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
}
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothGATT;
}
interface BluetoothRequestOptions {
  filters?: { services?: string[] }[];
  optionalServices?: string[];
}
interface Bluetooth {
  requestDevice(options: BluetoothRequestOptions): Promise<BluetoothDevice>;
}
interface Navigator {
  bluetooth: Bluetooth;
}
