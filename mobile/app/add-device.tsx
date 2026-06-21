import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, Label, Spinner, Text, TextField } from 'heroui-native';
import { Bluetooth, CheckCircle2, SignalHigh, SignalLow, SignalMedium } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ble, type ScannedDevice } from '@/lib/ble';
import { useDeviceStore } from '@/lib/store';

type Step = 'scan' | 'wifi' | 'connecting' | 'name';

export default function AddDevice() {
  const insets = useSafeAreaInsets();
  const addDevice = useDeviceStore((s) => s.addDevice);

  const [step, setStep] = useState<Step>('scan');
  const [found, setFound] = useState<ScannedDevice[]>([]);
  const [selected, setSelected] = useState<ScannedDevice | null>(null);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const scanning = useRef(false);

  useEffect(() => {
    if (step !== 'scan' || scanning.current) return undefined;
    scanning.current = true;
    setFound([]);
    void ble.scan((d) => {
      setFound((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
    });
    return () => {
      scanning.current = false;
    };
  }, [step]);

  const selectDevice = (d: ScannedDevice) => {
    setSelected(d);
    setName(d.name);
    setStep('wifi');
  };

  const submitWifi = async () => {
    if (!selected || !ssid.trim()) return;
    setConnectError(null);
    setStep('connecting');
    const result = await ble.provision(selected.id, ssid.trim(), password, (status, message) => {
      if (status === 'error') {
        setConnectError(message ?? 'Connection failed');
      }
    });
    if (result.status === 'connected') {
      setStep('name');
    } else {
      setConnectError((prev) => prev ?? 'Could not connect to WiFi');
    }
  };

  const finish = async () => {
    if (!selected) return;
    await addDevice({
      id: selected.id,
      name: name.trim() || selected.name,
      ssid: ssid.trim() || undefined,
      addedAt: Date.now(),
    });
    ble.disconnect();
    router.back();
    router.replace('/');
  };

  return (
    <View
      className="bg-background flex-1 px-5"
      style={{ paddingTop: 12, paddingBottom: insets.bottom + 16 }}
    >
      <StepDots step={step} />

      {step === 'scan' ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} className="flex-1">
          <View className="mt-6 items-center">
            <View className="bg-sally/15 h-20 w-20 items-center justify-center rounded-full">
              <Bluetooth size={34} color="#ed4c4c" />
            </View>
            <Text className="text-foreground mt-4 text-lg font-bold">
              Searching for Sally devices…
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <Spinner size="sm" />
              <Text className="text-muted text-sm">Make sure your sensor is powered on</Text>
            </View>
          </View>

          <View className="mt-8 gap-3">
            {found.map((d, i) => (
              <Animated.View key={d.id} entering={FadeInDown.delay(i * 60)}>
                <Pressable
                  onPress={() => selectDevice(d)}
                  className="bg-surface border-border flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-80"
                >
                  <Bluetooth size={20} color="#ed4c4c" />
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{d.name}</Text>
                    <Text className="text-muted text-xs">{d.id}</Text>
                  </View>
                  <SignalIcon rssi={d.rssi} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {step === 'wifi' ? (
        <Animated.View entering={FadeInDown} className="flex-1">
          <Text className="text-foreground mt-6 text-lg font-bold">WiFi credentials</Text>
          <Text className="text-muted mt-1 text-sm">
            {selected?.name} will use this network to connect.
          </Text>
          <View className="mt-6 gap-4">
            <TextField>
              <Label>Network name (SSID)</Label>
              <Input
                value={ssid}
                onChangeText={setSsid}
                placeholder="MyWiFi"
                autoCapitalize="none"
              />
            </TextField>
            <TextField>
              <Label>Password</Label>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
              />
            </TextField>
          </View>
          <View className="mt-auto gap-3">
            <Button onPress={submitWifi} isDisabled={!ssid.trim()}>
              <Button.Label>Connect</Button.Label>
            </Button>
            <Pressable onPress={() => setStep('scan')} className="items-center py-2">
              <Text className="text-muted text-sm">Back to scan</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {step === 'connecting' ? (
        <Animated.View entering={FadeIn} className="flex-1 items-center justify-center">
          {connectError ? (
            <>
              <Text className="text-aq-bad text-lg font-bold">Connection failed</Text>
              <Text className="text-muted mt-2 text-center text-sm">{connectError}</Text>
              <Button className="mt-6" onPress={() => setStep('wifi')}>
                <Button.Label>Try again</Button.Label>
              </Button>
            </>
          ) : (
            <>
              <Spinner size="lg" />
              <Text className="text-foreground mt-5 text-lg font-bold">Connecting…</Text>
              <Text className="text-muted mt-2 text-sm">Sending WiFi to {selected?.name}</Text>
            </>
          )}
        </Animated.View>
      ) : null}

      {step === 'name' ? (
        <Animated.View entering={FadeIn} className="flex-1">
          <Animated.View entering={ZoomIn} className="mt-8 items-center">
            <CheckCircle2 size={64} color="#4ade80" />
            <Text className="text-foreground mt-4 text-lg font-bold">Connected!</Text>
          </Animated.View>
          <Text className="text-muted mt-6 text-sm">Give your device a friendly name.</Text>
          <View className="mt-3">
            <TextField>
              <Input value={name} onChangeText={setName} placeholder="Living Room Sensor" />
            </TextField>
          </View>
          <View className="mt-auto">
            <Button onPress={finish} isDisabled={!name.trim()}>
              <Button.Label>Done</Button.Label>
            </Button>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ['scan', 'wifi', 'connecting', 'name'];
  const active = order.indexOf(step);
  return (
    <View className="flex-row justify-center gap-2 pt-2">
      {order.map((s, i) => (
        <View
          key={s}
          className="h-1.5 rounded-full"
          style={{
            width: i === active ? 24 : 8,
            backgroundColor: i <= active ? '#ed4c4c' : '#3f3f46',
          }}
        />
      ))}
    </View>
  );
}

function SignalIcon({ rssi }: { rssi: number }) {
  if (rssi >= -55) return <SignalHigh size={18} color="#4ade80" />;
  if (rssi >= -70) return <SignalMedium size={18} color="#facc15" />;
  return <SignalLow size={18} color="#ef4444" />;
}
