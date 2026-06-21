import { Text } from 'heroui-native';
import { View } from 'react-native';

import type { LiveConnection } from '@/lib/useLiveStream';

const MAP: Record<LiveConnection, { label: string; color: string }> = {
  connecting: { label: 'Connecting', color: '#9ca3af' },
  live: { label: 'Live', color: '#4ade80' },
  polling: { label: 'Polling', color: '#facc15' },
  error: { label: 'Offline', color: '#ef4444' },
};

export function ConnectionBadge({ connection }: { connection: LiveConnection }) {
  const { label, color } = MAP[connection];
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1"
      style={{ backgroundColor: `${color}22` }}
    >
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs font-bold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
