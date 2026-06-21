import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text } from 'heroui-native';
import {
  ArrowLeft,
  CameraOff,
  Cpu,
  Globe,
  Settings as SettingsIcon,
  Signal,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AqiBreakdownBar, Pm25Chart } from '@/components/Charts';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { AqLevelPill, GaugeCard } from '@/components/GaugeCard';
import { fetchAqHistory } from '@/lib/api';
import { aqColor, aqLevel } from '@/lib/aq';
import { hapticForLevelChange } from '@/lib/haptics';
import { useDeviceStore } from '@/lib/store';
import type { AqHistoryPoint, AqLevel, AqPeriod } from '@/lib/types';
import { useLiveStream } from '@/lib/useLiveStream';

type Segment = 'live' | 'history';

export default function DeviceLiveView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const devices = useDeviceStore((s) => s.devices);
  const device = useMemo(() => devices.find((d) => d.id === id), [devices, id]);
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('live');

  const live = useLiveStream(id);
  const prevLevel = useRef<AqLevel | null>(null);

  useEffect(() => {
    if (live.aq) {
      const next = aqLevel(live.aq.pm25);
      hapticForLevelChange(prevLevel.current, next);
      prevLevel.current = next;
    }
  }, [live.aq]);

  const pm25 = live.aq?.pm25 ?? null;
  const color = pm25 == null ? '#9ca3af' : aqColor(pm25);

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <ArrowLeft size={22} color="#fafafa" />
        </Pressable>
        <Text className="text-foreground text-base font-bold" numberOfLines={1}>
          {device?.name ?? 'Device'}
        </Text>
        <Pressable
          onPress={() => id && router.push(`/device/${id}/settings`)}
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <SettingsIcon size={20} color="#fafafa" />
        </Pressable>
      </View>

      {/* Camera */}
      <View className="bg-sally-ink aspect-square w-full items-center justify-center overflow-hidden">
        {live.frameUri ? (
          <Image source={{ uri: live.frameUri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="items-center gap-2">
            {live.connection === 'connecting' ? (
              <ActivityIndicator color="#ed4c4c" />
            ) : (
              <CameraOff size={32} color="#52525b" />
            )}
            <Text className="text-muted text-sm">
              {live.connection === 'connecting' ? 'Connecting to camera…' : 'No live frame'}
            </Text>
          </View>
        )}
        <View className="absolute top-3 left-3">
          <ConnectionBadge connection={live.connection} />
        </View>
        {live.obstructed ? (
          <View className="bg-aq-bad/80 absolute bottom-3 self-center rounded-full px-3 py-1">
            <Text className="text-xs font-bold text-white">Lens obstructed</Text>
          </View>
        ) : null}
      </View>

      {/* Segmented control */}
      <View className="bg-surface mx-4 mt-3 flex-row rounded-xl p-1">
        <SegmentButton
          label="Live"
          active={segment === 'live'}
          onPress={() => setSegment('live')}
        />
        <SegmentButton
          label="History"
          active={segment === 'history'}
          onPress={() => setSegment('history')}
        />
      </View>

      {segment === 'live' ? (
        <LivePanel live={live} pm25={pm25} color={color} bottomPad={insets.bottom + 24} />
      ) : (
        <HistoryPanel deviceId={id} bottomPad={insets.bottom + 24} />
      )}
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-sally' : ''}`}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function LivePanel({
  live,
  pm25,
  color,
  bottomPad,
}: {
  live: ReturnType<typeof useLiveStream>;
  pm25: number | null;
  color: string;
  bottomPad: number;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
      <AqLevelPill pm25={pm25} />

      <View className="mt-4">
        <GaugeCard label="PM2.5" value={live.aq?.pm25 ?? null} primary colorHex={color} />
      </View>

      <View className="mt-3 flex-row gap-3">
        <GaugeCard label="PM1.0" value={live.aq?.pm1 ?? null} />
        <GaugeCard label="PM10" value={live.aq?.pm10 ?? null} />
      </View>

      <Text className="text-muted mt-6 mb-2 text-xs font-semibold uppercase">Device info</Text>
      <View className="bg-surface border-border gap-3 rounded-2xl border p-4">
        <InfoRow
          icon={<Cpu size={16} color="#9ca3af" />}
          label="Firmware"
          value={live.info?.firmware ?? '—'}
        />
        <InfoRow
          icon={<Signal size={16} color="#9ca3af" />}
          label="WiFi RSSI"
          value={live.info?.rssi != null ? `${live.info.rssi} dBm` : '—'}
        />
        <InfoRow
          icon={<Globe size={16} color="#9ca3af" />}
          label="IP address"
          value={live.info?.ip ?? '—'}
        />
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="text-muted text-sm">{label}</Text>
      </View>
      <Text className="text-foreground text-sm font-semibold">{value}</Text>
    </View>
  );
}

const PERIODS: { key: AqPeriod; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

function HistoryPanel({
  deviceId,
  bottomPad,
}: {
  deviceId: string | undefined;
  bottomPad: number;
}) {
  const [period, setPeriod] = useState<AqPeriod>('24h');
  const [points, setPoints] = useState<AqHistoryPoint[]>([]);
  const [mocked, setMocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!deviceId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    fetchAqHistory(deviceId, period, controller.signal)
      .then((res) => {
        setPoints(res.points);
        setMocked(res.mocked);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [deviceId, period]);

  const avg = points.length > 0 ? points.reduce((a, p) => a + p.pm25, 0) / points.length : null;
  const peak = points.length > 0 ? Math.max(...points.map((p) => p.pm25)) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad }}>
      <View className="flex-row gap-2">
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => setPeriod(p.key)}
            className={`flex-1 items-center rounded-lg border py-2 ${
              period === p.key ? 'border-sally bg-sally/15' : 'border-border bg-surface'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${period === p.key ? 'text-sally' : 'text-muted'}`}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="bg-surface border-border mt-4 rounded-2xl border p-4">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-foreground font-bold">PM2.5 trend</Text>
          {mocked ? <Text className="text-muted text-[10px]">sample data</Text> : null}
        </View>
        {loading ? (
          <View className="h-44 items-center justify-center">
            <ActivityIndicator color="#ed4c4c" />
          </View>
        ) : (
          <Pm25Chart points={points} width={width - 64} />
        )}
        <View className="mt-2 flex-row justify-around">
          <Stat label="Average" value={avg == null ? '--' : avg.toFixed(1)} />
          <Stat label="Peak" value={peak == null ? '--' : peak.toFixed(1)} />
          <Stat label="Readings" value={String(points.length)} />
        </View>
      </View>

      <View className="bg-surface border-border mt-4 rounded-2xl border p-4">
        <Text className="text-foreground mb-3 font-bold">Time in each zone</Text>
        <AqiBreakdownBar points={points} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text className="text-foreground text-lg font-bold">{value}</Text>
      <Text className="text-muted text-xs">{label}</Text>
    </View>
  );
}
