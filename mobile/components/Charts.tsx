import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from 'heroui-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AQ_COLORS, aqLevel } from '@/lib/aq';
import type { AqHistoryPoint } from '@/lib/types';

interface ChartProps {
  points: AqHistoryPoint[];
  width: number;
  height?: number;
}

export function Pm25Chart({ points, width, height = 180 }: ChartProps) {
  const { linePath, areaPath } = useMemo(() => {
    if (points.length < 2) return { linePath: '', areaPath: '', maxV: 1 };
    const padding = { top: 12, bottom: 12, left: 8, right: 8 };
    const w = width - padding.left - padding.right;
    const h = height - padding.top - padding.bottom;
    const max = Math.max(40, ...points.map((p) => p.pm25));
    const min = 0;
    const n = points.length;
    const x = (i: number) => padding.left + (i / (n - 1)) * w;
    const y = (v: number) => padding.top + h - ((v - min) / (max - min)) * h;

    let line = `M ${x(0)} ${y(points[0].pm25)}`;
    for (let i = 1; i < n; i++) {
      const cx = (x(i - 1) + x(i)) / 2;
      line += ` C ${cx} ${y(points[i - 1].pm25)}, ${cx} ${y(points[i].pm25)}, ${x(i)} ${y(points[i].pm25)}`;
    }
    const area = `${line} L ${x(n - 1)} ${padding.top + h} L ${x(0)} ${padding.top + h} Z`;
    return { linePath: line, areaPath: area, maxV: max };
  }, [points, width, height]);

  if (!linePath) {
    return (
      <View style={{ height }} className="items-center justify-center">
        <Text className="text-muted text-sm">Not enough data</Text>
      </View>
    );
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="pm25grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ed4c4c" stopOpacity={0.35} />
          <Stop offset="1" stopColor="#ed4c4c" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#pm25grad)" />
      <Path d={linePath} stroke="#ed4c4c" strokeWidth={2.5} fill="none" />
      {/* max label */}
    </Svg>
  );
}

interface BreakdownProps {
  points: AqHistoryPoint[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Horizontal bar showing share of time spent in each AQ zone. */
export function AqiBreakdownBar({ points }: BreakdownProps) {
  const { good, moderate, unhealthy } = useMemo(() => {
    const counts = { good: 0, moderate: 0, unhealthy: 0 };
    for (const p of points) counts[aqLevel(p.pm25)] += 1;
    const total = points.length || 1;
    return {
      good: counts.good / total,
      moderate: counts.moderate / total,
      unhealthy: counts.unhealthy / total,
    };
  }, [points]);

  return (
    <View>
      <View className="h-3 w-full flex-row overflow-hidden rounded-full">
        <View style={{ flex: Math.max(good, 0.001), backgroundColor: AQ_COLORS.good }} />
        <View style={{ flex: Math.max(moderate, 0.001), backgroundColor: AQ_COLORS.moderate }} />
        <View style={{ flex: Math.max(unhealthy, 0.001), backgroundColor: AQ_COLORS.unhealthy }} />
      </View>
      <View className="mt-3 flex-row justify-between">
        <Legend color={AQ_COLORS.good} label="Good" value={pct(good)} />
        <Legend color={AQ_COLORS.moderate} label="Moderate" value={pct(moderate)} />
        <Legend color={AQ_COLORS.unhealthy} label="Unhealthy" value={pct(unhealthy)} />
      </View>
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-muted text-xs">{label}</Text>
      <Text className="text-foreground text-xs font-bold">{value}</Text>
    </View>
  );
}
