import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Input, Spinner, Text, TextField } from 'heroui-native';
import { CheckCircle2, DownloadCloud, Trash2, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchStatus, triggerOta } from '@/lib/api';
import { useDeviceStore } from '@/lib/store';
import type { DeviceStatus } from '@/lib/types';

export default function DeviceSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const devices = useDeviceStore((s) => s.devices);
  const updateDevice = useDeviceStore((s) => s.updateDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);
  const device = useMemo(() => devices.find((d) => d.id === id), [devices, id]);
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(device?.name ?? '');
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [otaDone, setOtaDone] = useState(false);

  useEffect(() => {
    if (device) setName(device.name);
  }, [device]);

  const checkUpdate = async () => {
    if (!id) return;
    setChecking(true);
    try {
      const s = await fetchStatus(id);
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setChecking(true);
    fetchStatus(id)
      .then((s) => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setChecking(false));
  }, [id]);

  const saveName = async () => {
    if (!id || !name.trim()) return;
    await updateDevice(id, { name: name.trim() });
  };

  const runOta = async () => {
    if (!id || !status?.firmware_url) return;
    setUpdating(true);
    const ok = await triggerOta(id, status.firmware_url);
    setUpdating(false);
    if (ok) {
      setOtaDone(true);
      if (status.latest_firmware) await updateDevice(id, { firmware: status.latest_firmware });
    } else {
      Alert.alert('Update failed', 'Could not start the OTA update. Try again.');
    }
  };

  const confirmRemove = () => {
    Alert.alert('Remove device', `Remove "${device?.name}" from this app?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (id) await removeDevice(id);
          router.dismissAll();
          router.replace('/');
        },
      },
    ]);
  };

  const updateAvailable = Boolean(status?.update_available && status?.firmware_url);

  if (!device) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Text className="text-muted">Device not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
    >
      <Text className="text-muted mb-2 text-xs font-semibold uppercase">Name</Text>
      <View className="bg-surface border-border rounded-2xl border p-4">
        <TextField>
          <Input value={name} onChangeText={setName} placeholder="Device name" onBlur={saveName} />
        </TextField>
      </View>

      <Text className="text-muted mt-6 mb-2 text-xs font-semibold uppercase">Info</Text>
      <View className="bg-surface border-border gap-3 rounded-2xl border p-4">
        <Row label="Device ID" value={device.id} />
        <Row label="Firmware" value={device.firmware ?? status?.firmware ?? '—'} />
        <Row label="WiFi network" value={device.ssid ?? '—'} />
        <Row label="Status" value={status == null ? '—' : status.online ? 'Online' : 'Offline'} />
      </View>

      <Text className="text-muted mt-6 mb-2 text-xs font-semibold uppercase">Firmware</Text>
      <View className="bg-surface border-border rounded-2xl border p-4">
        {checking ? (
          <View className="flex-row items-center gap-2">
            <Spinner size="sm" />
            <Text className="text-muted text-sm">Checking for updates…</Text>
          </View>
        ) : otaDone ? (
          <View className="flex-row items-center gap-2">
            <CheckCircle2 size={18} color="#4ade80" />
            <Text className="text-foreground text-sm font-semibold">Update started</Text>
          </View>
        ) : updateAvailable ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <DownloadCloud size={18} color="#facc15" />
              <Text className="text-foreground text-sm font-semibold">
                Update to {status?.latest_firmware ?? 'latest'}
              </Text>
            </View>
            <Button onPress={runOta} isDisabled={updating}>
              <Button.Label>{updating ? 'Updating…' : 'Install update'}</Button.Label>
            </Button>
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="text-muted text-sm">You&apos;re on the latest firmware</Text>
            <Pressable onPress={checkUpdate}>
              <Text className="text-sally text-sm font-semibold">Check</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text className="text-muted mt-6 mb-2 text-xs font-semibold uppercase">Connectivity</Text>
      <Pressable
        onPress={() => router.push('/add-device')}
        className="bg-surface border-border flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-80"
      >
        <Wifi size={18} color="#ed4c4c" />
        <View className="flex-1">
          <Text className="text-foreground text-sm font-semibold">Reconfigure WiFi</Text>
          <Text className="text-muted text-xs">Re-run Bluetooth setup for this device</Text>
        </View>
      </Pressable>

      <Pressable
        onPress={confirmRemove}
        className="border-danger/40 mt-8 flex-row items-center justify-center gap-2 rounded-2xl border p-4 active:opacity-80"
      >
        <Trash2 size={18} color="#ef4444" />
        <Text className="text-aq-bad text-sm font-bold">Remove device</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-muted text-sm">{label}</Text>
      <Text className="text-foreground text-sm font-semibold" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
