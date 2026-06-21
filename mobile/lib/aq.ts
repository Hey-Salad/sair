import type { AqLevel, AqReading } from './types';

/**
 * Air-quality colour + label logic, centred on PM2.5.
 * good: pm25 <= 12, moderate: <= 35, unhealthy: > 35
 */
export function aqLevel(pm25: number): AqLevel {
  if (pm25 <= 12) return 'good';
  if (pm25 <= 35) return 'moderate';
  return 'unhealthy';
}

export function aqLabel(level: AqLevel): string {
  switch (level) {
    case 'good':
      return 'Good';
    case 'moderate':
      return 'Moderate';
    case 'unhealthy':
      return 'Unhealthy';
    default:
      return level;
  }
}

/** Hex colours used in non-className contexts (charts, svg, icon tints). */
export const AQ_COLORS: Record<AqLevel, string> = {
  good: '#4ade80',
  moderate: '#facc15',
  unhealthy: '#ef4444',
};

export function aqColor(pm25: number): string {
  return AQ_COLORS[aqLevel(pm25)];
}

export function aqLevelFromReading(r: AqReading): AqLevel {
  return aqLevel(r.pm25);
}
