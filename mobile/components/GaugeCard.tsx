import { Text } from 'heroui-native';
import { Activity } from 'lucide-react-native';
import { View } from 'react-native';

import { aqColor, aqLabel, aqLevel } from '@/lib/aq';
import { cn } from '@/lib/utils';

interface GaugeCardProps {
  label: string;
  value: number | null;
  unit?: string;
  /** when true, render larger emphasis (the PM2.5 hero card) */
  primary?: boolean;
  /** colour for the value text/border */
  colorHex?: string;
}

export function GaugeCard({ label, value, unit = 'µg/m³', primary, colorHex }: GaugeCardProps) {
  const color = colorHex ?? '#9ca3af';
  return (
    <View
      className={cn(
        'bg-surface border-border rounded-2xl border px-4 py-4',
        primary ? 'items-center py-6' : 'flex-1 items-center',
      )}
      style={primary ? { borderColor: color } : undefined}
    >
      <Text className={cn('text-muted font-medium', primary ? 'text-sm' : 'text-xs')}>{label}</Text>
      <Text className={cn('font-extrabold', primary ? 'text-6xl' : 'text-2xl')} style={{ color }}>
        {value == null ? '--' : value.toFixed(primary ? 1 : 0)}
      </Text>
      <Text className={cn('text-muted', primary ? 'text-sm' : 'text-[10px]')}>{unit}</Text>
    </View>
  );
}

interface AqLevelPillProps {
  pm25: number | null;
}

/** Pill showing the PM2.5 level label with its colour, e.g. "Good". */
export function AqLevelPill({ pm25 }: AqLevelPillProps) {
  if (pm25 == null) {
    return (
      <View className="bg-default flex-row items-center gap-2 self-center rounded-full px-4 py-1.5">
        <Activity size={14} color="#9ca3af" />
        <Text className="text-muted text-sm font-semibold">No data</Text>
      </View>
    );
  }
  const color = aqColor(pm25);
  return (
    <View
      className="flex-row items-center gap-2 self-center rounded-full px-4 py-1.5"
      style={{ backgroundColor: `${color}22` }}
    >
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-sm font-bold" style={{ color }}>
        {aqLabel(aqLevel(pm25))}
      </Text>
    </View>
  );
}
