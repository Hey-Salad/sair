import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from 'heroui-native';
import { Plus, Wind } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DeviceCard } from '@/components/DeviceCard';
import { useDeviceStore } from '@/lib/store';

export default function Dashboard() {
  const devices = useDeviceStore((s) => s.devices);
  const hydrated = useDeviceStore((s) => s.hydrated);
  const hydrate = useDeviceStore((s) => s.hydrate);
  const insets = useSafeAreaInsets();

  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View className="bg-background flex-1">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ed4c4c" />
        }
      >
        {devices.length === 0 ? (
          <EmptyState />
        ) : (
          devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              refreshKey={refreshKey}
              onPress={() => router.push(`/device/${device.id}`)}
            />
          ))
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/add-device')}
        className="bg-sally absolute right-5 h-14 w-14 items-center justify-center rounded-full active:opacity-80"
        style={{ bottom: insets.bottom + 20, elevation: 6 }}
      >
        <Plus size={28} color="#ffffff" />
      </Pressable>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="mt-24 items-center px-6">
      <View className="bg-surface mb-5 h-20 w-20 items-center justify-center rounded-3xl">
        <Wind size={36} color="#ed4c4c" />
      </View>
      <Text className="text-foreground text-xl font-bold">No devices yet</Text>
      <Text className="text-muted mt-2 text-center text-sm">
        Add your first Sally sensor to start monitoring air quality and live camera.
      </Text>
      <Text className="text-muted mt-6 text-center text-xs">Tap + to add a device.</Text>
    </View>
  );
}
