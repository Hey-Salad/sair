import { LayoutGrid, Settings } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';

export default function TabLayout() {
  const [background, foreground, border, accent, muted] = useThemeColor([
    'background',
    'foreground',
    'border',
    'accent',
    'muted',
  ]);

  return (
    <>
      {/* expo-status-bar's `style` prop is a string enum, not a React style object */}
      {/* eslint-disable-next-line react/style-prop-object -- expo-status-bar style is a string enum, not a React style object */}
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: background },
          headerTintColor: foreground,
          headerTitleStyle: { color: foreground, fontFamily: 'Figtree_700Bold' },
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: background },
          tabBarStyle: {
            backgroundColor: background,
            borderTopColor: border,
          },
          tabBarLabelStyle: { fontFamily: 'Figtree_500Medium' },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'sally air',
            tabBarLabel: 'Devices',
            tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size ?? 24} />,
          }}
        />
      </Tabs>
    </>
  );
}
