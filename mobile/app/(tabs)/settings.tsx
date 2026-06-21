import { useEffect } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { Switch, Text } from 'heroui-native';
import { Bell, ExternalLink, Thermometer } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/lib/store';

export default function SettingsScreen() {
  const settings = useSettingsStore((s) => s.settings);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const update = useSettingsStore((s) => s.update);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
    >
      <Text className="text-muted mb-2 text-xs font-semibold uppercase">Notifications</Text>
      <View className="bg-surface border-border rounded-2xl border">
        <Row
          icon={<Bell size={18} color="#ed4c4c" />}
          title="Air quality alerts"
          subtitle="Notify when PM2.5 goes above 35"
        >
          <Switch
            isSelected={settings.notifyOnUnhealthy}
            onSelectedChange={(v) => void update({ notifyOnUnhealthy: v })}
          />
        </Row>
      </View>

      <Text className="text-muted mt-6 mb-2 text-xs font-semibold uppercase">Units</Text>
      <View className="bg-surface border-border rounded-2xl border">
        <Row
          icon={<Thermometer size={18} color="#ed4c4c" />}
          title="Temperature unit"
          subtitle="For upcoming temperature sensors"
        >
          <View className="bg-default flex-row rounded-lg p-0.5">
            {(['C', 'F'] as const).map((u) => (
              <Pressable
                key={u}
                onPress={() => void update({ tempUnit: u })}
                className={`rounded-md px-3 py-1 ${settings.tempUnit === u ? 'bg-sally' : ''}`}
              >
                <Text
                  className={`text-sm font-bold ${settings.tempUnit === u ? 'text-white' : 'text-muted'}`}
                >
                  °{u}
                </Text>
              </Pressable>
            ))}
          </View>
        </Row>
      </View>

      <Text className="text-muted mt-6 mb-2 text-xs font-semibold uppercase">About</Text>
      <View className="bg-surface border-border rounded-2xl border">
        <Pressable
          onPress={() => void Linking.openURL('https://heysalad.app')}
          className="flex-row items-center justify-between p-4 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <ExternalLink size={18} color="#ed4c4c" />
            <Text className="text-foreground font-semibold">Visit heysalad.app</Text>
          </View>
        </Pressable>
        <View className="border-border border-t px-4 py-4">
          <Text className="text-muted text-sm">App version {version}</Text>
        </View>
      </View>

      <View className="mt-10 items-center">
        <Text className="text-foreground text-2xl font-extrabold lowercase">sally air</Text>
        <Text className="text-muted mt-1 text-sm">
          Powered by <Text className="text-sally font-bold">HeySalad</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      {icon}
      <View className="flex-1">
        <Text className="text-foreground font-semibold">{title}</Text>
        <Text className="text-muted text-xs">{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}
