/**
 * Sally Air domain types.
 */

export interface Device {
  /** Unique device id, e.g. "CCBA9716248C" */
  id: string;
  /** Friendly user-chosen name */
  name: string;
  /** Last known firmware version */
  firmware?: string;
  /** Last known wifi SSID configured during setup */
  ssid?: string;
  /** Created timestamp (ms) */
  addedAt: number;
}

export interface AqReading {
  pm1: number;
  pm25: number;
  pm10: number;
  obstructed?: boolean;
}

/** Hello message sent by device over the WebSocket on connect. */
export interface DeviceHello {
  type: 'hello';
  firmware?: string;
  rssi?: number;
  ip?: string;
  device_id?: string;
}

export interface AqMessage extends AqReading {
  type: 'aq';
}

export type DeviceWsMessage = DeviceHello | AqMessage | { type: string; [k: string]: unknown };

export interface DeviceStatus {
  success: boolean;
  device_id: string;
  online: boolean;
  has_frame: boolean;
  last_frame_age_ms: number | null;
  ws_clients: number;
  /** Optional fields the worker may add for OTA */
  firmware?: string;
  latest_firmware?: string;
  update_available?: boolean;
  firmware_url?: string;
}

export interface AqHistoryPoint {
  /** epoch ms */
  t: number;
  pm25: number;
}

export type AqLevel = 'good' | 'moderate' | 'unhealthy';

export type AqPeriod = '24h' | '7d' | '30d';

export interface AppSettings {
  notifyOnUnhealthy: boolean;
  tempUnit: 'C' | 'F';
}
