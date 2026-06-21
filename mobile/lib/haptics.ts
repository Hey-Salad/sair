import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { AqLevel } from './types';

/** Fires a haptic when the AQ level transitions to a worse/different state. */
export function hapticForLevelChange(prev: AqLevel | null, next: AqLevel): void {
  if (Platform.OS === 'web') return;
  if (prev === next) return;
  const style =
    next === 'unhealthy'
      ? Haptics.NotificationFeedbackType.Error
      : next === 'moderate'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success;
  void Haptics.notificationAsync(style);
}
