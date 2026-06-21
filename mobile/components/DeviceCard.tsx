import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Text } from 'heroui-native';
import { Camera, ChevronRight, Wifi, WifiOff } from 'lucide-react-native';

import { fetchSnapshot, fetchStatus } from '@/lib/api';
import { aqColor, aqLabel, aqLevel } from '@/lib/aq';
import type { Device } from '@/lib/types';

interface DeviceCardProps {
  device: Device;
  /** bump to force a re-fetch (pull to refresh) */
  refreshKey: number;
  onPress: () => void;
}

export function DeviceCard({ device, refreshKey, onPress }: DeviceCardProps) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [pm25, setPm25] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const status = await fetchStatus(device.id, controller.signal);
        if (!mounted.current) return;
        setOnline(status.online);
      } catch {
        if (mounted.current) setOnline(false);
      }
      try {
        const { uri, aq } = await fetchSnapshot(device.id, controller.signal);
        if (!mounted.current) return;
        if (uri) setThumb(uri);
        if (aq && typeof aq.pm25 === 'number') setPm25(aq.pm25);
      } catch {
        // no frame yet
      }
    };
    void load();
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [device.id, refreshKey]);

  const dotColor = online == null ? '#9ca3af' : online ? '#4ade80' : '#71717a';
  const badgeColor = pm25 == null ? '#9ca3af' : aqColor(pm25);

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface border-border mb-3 flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-80"
    >
      <View className="bg-default h-16 w-16 items-center justify-center overflow-hidden rounded-xl">
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: 64, height: 64 }} resizeMode="cover" />
        ) : (
          <Camera size={22} color="#71717a" />
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
          <Text className="text-foreground flex-1 text-base font-bold" numberOfLines={1}>
            {device.name}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center gap-1.5">
          {online ? <Wifi size={13} color="#9ca3af" /> : <WifiOff size={13} color="#9ca3af" />}
          <Text className="text-muted text-xs">
            {online == null ? 'Checking…' : online ? 'Online' : 'Offline'}
          </Text>
        </View>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: `${badgeColor}22` }}>
            <Text className="text-xs font-bold" style={{ color: badgeColor }}>
              PM2.5 {pm25 == null ? '--' : pm25.toFixed(0)}
            </Text>
          </View>
          {pm25 != null ? (
            <Text className="text-muted text-xs">{aqLabel(aqLevel(pm25))}</Text>
          ) : null}
        </View>
      </View>

      <ChevronRight size={20} color="#52525b" />
    </Pressable>
  );
}
