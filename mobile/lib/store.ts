import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { AppSettings, Device } from './types';

const DEVICES_KEY = 'sally.devices.v1';
const SETTINGS_KEY = 'sally.settings.v1';

/** Narrows `any` from JSON.parse via `unknown` without a direct unsafe assertion. */
// eslint-disable-next-line typescript/no-unnecessary-type-parameters -- generic is intentional for call-site type inference
function parseJson<T>(value: unknown): T {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- JSON deserialization boundary; no runtime validator available
  return value as T;
}

interface DeviceStore {
  devices: Device[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addDevice: (device: Device) => Promise<void>;
  updateDevice: (id: string, patch: Partial<Device>) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  getDevice: (id: string) => Device | undefined;
}

async function persist(devices: Device[]) {
  try {
    await AsyncStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  } catch {
    // best-effort
  }
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(DEVICES_KEY);
      const devices = raw ? parseJson<Device[]>(JSON.parse(raw)) : [];
      set({ devices, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  addDevice: async (device) => {
    const exists = get().devices.some((d) => d.id === device.id);
    const devices = exists
      ? get().devices.map((d) => (d.id === device.id ? { ...d, ...device } : d))
      : [...get().devices, device];
    set({ devices });
    await persist(devices);
  },
  updateDevice: async (id, patch) => {
    const devices = get().devices.map((d) => (d.id === id ? { ...d, ...patch } : d));
    set({ devices });
    await persist(devices);
  },
  removeDevice: async (id) => {
    const devices = get().devices.filter((d) => d.id !== id);
    set({ devices });
    await persist(devices);
  },
  getDevice: (id) => get().devices.find((d) => d.id === id),
}));

interface SettingsStore {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = { notifyOnUnhealthy: true, tempUnit: 'C' };

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = raw
        ? { ...DEFAULT_SETTINGS, ...parseJson<Partial<AppSettings>>(JSON.parse(raw)) }
        : DEFAULT_SETTINGS;
      set({ settings, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  update: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // best-effort
    }
  },
}));
