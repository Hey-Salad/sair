import type { AqHistoryPoint, AqPeriod, DeviceStatus } from './types';

export const BASE_URL = 'https://sally-camera-stream.heysalad-o.workers.dev';

export function wsViewerUrl(deviceId: string): string {
  return `wss://sally-camera-stream.heysalad-o.workers.dev/ws/viewer?device_id=${encodeURIComponent(deviceId)}`;
}

export function snapshotUrl(deviceId: string): string {
  return `${BASE_URL}/snapshot?device_id=${encodeURIComponent(deviceId)}`;
}

interface SnapshotResponse {
  success?: boolean;
  /** base64 JPEG (may or may not include data uri prefix) */
  frame?: string;
  image?: string;
  data?: string;
  aq?: { pm1?: number; pm25?: number; pm10?: number; obstructed?: boolean };
}

/** Type-safe JSON deserializer — narrows `any` from JSON.parse / res.json() via `unknown`. */
// eslint-disable-next-line typescript/no-unnecessary-type-parameters -- generic is intentional for call-site type inference
function parseJson<T>(value: unknown): T {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- JSON deserialization boundary; no runtime validator available
  return value as T;
}

/** Returns a displayable image URI (data uri) or null. */
export async function fetchSnapshot(
  deviceId: string,
  signal?: AbortSignal,
): Promise<{ uri: string | null; aq?: SnapshotResponse['aq'] }> {
  const res = await fetch(snapshotUrl(deviceId), { signal });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  const json = parseJson<SnapshotResponse>(await res.json());
  const raw = json.frame ?? json.image ?? json.data ?? null;
  if (!raw) return { uri: null, aq: json.aq };
  const uri = raw.startsWith('data:') ? raw : `data:image/jpeg;base64,${raw}`;
  return { uri, aq: json.aq };
}

export async function fetchStatus(deviceId: string, signal?: AbortSignal): Promise<DeviceStatus> {
  const res = await fetch(`${BASE_URL}/status?device_id=${encodeURIComponent(deviceId)}`, {
    signal,
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return parseJson<DeviceStatus>(await res.json());
}

interface AqHistoryResponse {
  success?: boolean;
  points?: { t?: number; ts?: number; time?: number; pm25?: number; value?: number }[];
  history?: { t?: number; ts?: number; time?: number; pm25?: number; value?: number }[];
}

/**
 * Fetches PM2.5 history. Falls back to a realistic mock sine wave (2-30 µg/m³)
 * when the endpoint is unavailable or returns no data.
 */
export async function fetchAqHistory(
  deviceId: string,
  period: AqPeriod,
  signal?: AbortSignal,
): Promise<{ points: AqHistoryPoint[]; mocked: boolean }> {
  try {
    const res = await fetch(
      `${BASE_URL}/aq-history?device_id=${encodeURIComponent(deviceId)}&period=${period}`,
      { signal },
    );
    if (!res.ok) throw new Error(`aq-history ${res.status}`);
    const json = parseJson<AqHistoryResponse>(await res.json());
    const rows = json.points ?? json.history ?? [];
    const points: AqHistoryPoint[] = rows
      .map((r) => ({
        t: r.t ?? r.ts ?? r.time ?? 0,
        pm25: r.pm25 ?? r.value ?? 0,
      }))
      .filter((p) => p.t > 0);
    if (points.length > 0) return { points, mocked: false };
    return { points: mockHistory(period), mocked: true };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return { points: mockHistory(period), mocked: true };
  }
}

export function mockHistory(period: AqPeriod): AqHistoryPoint[] {
  const now = Date.now();
  const config: Record<AqPeriod, { spanMs: number; count: number }> = {
    '24h': { spanMs: 24 * 3600_000, count: 48 },
    '7d': { spanMs: 7 * 24 * 3600_000, count: 84 },
    '30d': { spanMs: 30 * 24 * 3600_000, count: 90 },
  };
  const { spanMs, count } = config[period];
  const points: AqHistoryPoint[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / (count - 1);
    const t = now - spanMs + frac * spanMs;
    // base sine between 2-30, with a faster daily ripple + small noise
    const slow = Math.sin(frac * Math.PI * 2) * 0.5 + 0.5;
    const daily = Math.sin(frac * Math.PI * 2 * (period === '24h' ? 1 : 6)) * 0.25 + 0.25;
    const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const pm25 = Math.max(2, Math.min(30, 2 + (slow * 0.7 + daily * 0.3) * 26 + noise * 4));
    points.push({ t, pm25: Math.round(pm25 * 10) / 10 });
  }
  return points;
}

export async function triggerOta(deviceId: string, firmwareUrl: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/ota`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, firmware_url: firmwareUrl }),
  });
  return res.ok;
}
