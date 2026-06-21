import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { fetchSnapshot, wsViewerUrl } from './api';
import type { AqReading, DeviceHello } from './types';

export type LiveConnection = 'connecting' | 'live' | 'polling' | 'error';

export interface LiveState {
  connection: LiveConnection;
  frameUri: string | null;
  aq: AqReading | null;
  info: DeviceHello | null;
  obstructed: boolean;
}

const POLL_INTERVAL = 2000;
const WS_TIMEOUT = 6000;

/** Convert an ArrayBuffer of JPEG bytes to a displayable URI. */
function jpegToUri(buf: ArrayBuffer): string {
  if (Platform.OS === 'web' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
    return URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
  }
  // Native: base64-encode for a data uri.
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 =
    typeof globalThis.btoa === 'function' ? globalThis.btoa(binary) : nativeBtoa(binary);
  return `data:image/jpeg;base64,${base64}`;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function nativeBtoa(input: string): string {
  let output = '';
  for (let i = 0; i < input.length; ) {
    const c1 = input.charCodeAt(i++);
    const c2 = input.charCodeAt(i++);
    const c3 = input.charCodeAt(i++);
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (c2 >> 4);
    let e3 = ((c2 & 15) << 2) | (c3 >> 6);
    let e4 = c3 & 63;
    if (Number.isNaN(c2)) {
      e3 = 64;
      e4 = 64;
    } else if (Number.isNaN(c3)) {
      e4 = 64;
    }
    output += B64.charAt(e1) + B64.charAt(e2) + B64.charAt(e3) + B64.charAt(e4);
  }
  return output;
}

/** Narrows `any` from JSON.parse via `unknown` without a direct unsafe assertion. */
// eslint-disable-next-line typescript/no-unnecessary-type-parameters -- generic is intentional for call-site type inference
function parseJson<T>(value: unknown): T {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion -- JSON deserialization boundary; no runtime validator available
  return value as T;
}

/**
 * Connects to the device viewer WebSocket. Binary messages are JPEG frames,
 * text messages are JSON (hello / aq). Falls back to HTTP snapshot polling
 * if the socket fails to open or errors out.
 */
export function useLiveStream(deviceId: string | undefined): LiveState {
  const [state, setState] = useState<LiveState>({
    connection: 'connecting',
    frameUri: null,
    aq: null,
    info: null,
    obstructed: false,
  });

  const prevUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceId) return undefined;

    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let openTimer: ReturnType<typeof setTimeout> | null = null;
    let abort: AbortController | null = null;
    let disposed = false;
    let polling = false;

    // Handlers are hoisted so the cleanup closure can call removeEventListener.
    let handleOpen: (() => void) | null = null;
    let handleMessage: ((event: WebSocketMessageEvent) => void) | null = null;
    let handleError: (() => void) | null = null;
    let handleClose: (() => void) | null = null;

    const setFrame = (uri: string | null) => {
      // Revoke previous blob URL on web to avoid leaks.
      const prev = prevUriRef.current;
      if (prev && prev.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(prev);
      }
      prevUriRef.current = uri;
      setState((s) => ({ ...s, frameUri: uri }));
    };

    const startPolling = () => {
      if (disposed || polling) return;
      polling = true;
      setState((s) => ({ ...s, connection: 'polling' }));
      const tick = async () => {
        if (disposed) return;
        abort = new AbortController();
        try {
          const { uri, aq } = await fetchSnapshot(deviceId, abort.signal);
          if (disposed) return;
          if (uri) setFrame(uri);
          if (aq && typeof aq.pm25 === 'number') {
            setState((s) => ({
              ...s,
              aq: {
                pm1: aq.pm1 ?? 0,
                pm25: aq.pm25 ?? 0,
                pm10: aq.pm10 ?? 0,
                obstructed: aq.obstructed,
              },
              obstructed: Boolean(aq.obstructed),
            }));
          }
        } catch {
          // ignore; keep polling
        }
        if (!disposed) pollTimer = setTimeout(() => void tick(), POLL_INTERVAL);
      };
      void tick();
    };

    const connect = () => {
      try {
        ws = new WebSocket(wsViewerUrl(deviceId));
        ws.binaryType = 'arraybuffer';
      } catch {
        startPolling();
        return;
      }

      openTimer = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
          try {
            ws.close();
          } catch {
            // noop
          }
          startPolling();
        }
      }, WS_TIMEOUT);

      handleOpen = () => {
        if (openTimer) clearTimeout(openTimer);
        if (!disposed) setState((s) => ({ ...s, connection: 'live' }));
      };

      handleMessage = (event: WebSocketMessageEvent) => {
        if (disposed) return;
        const data = event.data as unknown;
        if (typeof data === 'string') {
          try {
            const msg = parseJson<Record<string, unknown>>(JSON.parse(data));
            if (msg.type === 'aq') {
              setState((s) => ({
                ...s,
                aq: {
                  pm1: Number(msg.pm1 ?? 0),
                  pm25: Number(msg.pm25 ?? 0),
                  pm10: Number(msg.pm10 ?? 0),
                  obstructed: Boolean(msg.obstructed),
                },
                obstructed: Boolean(msg.obstructed),
              }));
            } else if (msg.type === 'hello') {
              setState((s) => ({ ...s, info: parseJson<DeviceHello>(msg) }));
            }
          } catch {
            // ignore malformed json
          }
          return;
        }
        // Binary JPEG frame.
        if (data instanceof ArrayBuffer) {
          setFrame(jpegToUri(data));
        }
      };

      handleError = () => {
        if (openTimer) clearTimeout(openTimer);
        if (!disposed && !polling) startPolling();
      };

      handleClose = () => {
        if (openTimer) clearTimeout(openTimer);
        if (!disposed && !polling) startPolling();
      };

      ws.addEventListener('open', handleOpen);
      ws.addEventListener('message', handleMessage);
      ws.addEventListener('error', handleError);
      ws.addEventListener('close', handleClose);
    };

    connect();

    return () => {
      disposed = true;
      if (openTimer) clearTimeout(openTimer);
      if (pollTimer) clearTimeout(pollTimer);
      if (abort) abort.abort();
      if (ws) {
        if (handleOpen) ws.removeEventListener('open', handleOpen);
        if (handleMessage) ws.removeEventListener('message', handleMessage);
        if (handleError) ws.removeEventListener('error', handleError);
        if (handleClose) ws.removeEventListener('close', handleClose);
        try {
          ws.close();
        } catch {
          // noop
        }
      }
      const prev = prevUriRef.current;
      if (prev && prev.startsWith('blob:') && typeof URL !== 'undefined') {
        URL.revokeObjectURL(prev);
      }
    };
  }, [deviceId]);

  return state;
}
