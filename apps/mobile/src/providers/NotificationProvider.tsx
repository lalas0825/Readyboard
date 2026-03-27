/**
 * NotificationProvider — Handles push token registration and deep linking.
 *
 * Inserted in provider chain AFTER AuthProvider (needs userId).
 * Registers token on mount, listens for notification taps → navigates.
 *
 * Deep linking payload:
 * { screen: 'report' | 'area', id: string, areaId?: string }
 */

import { useEffect, useRef, type ReactNode } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { registerForPushNotificationsAsync } from '../services/pushNotifications';

type Props = {
  userId: string | null;
  children: ReactNode;
};

export function NotificationProvider({ userId, children }: Props) {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Register token
    registerForPushNotificationsAsync(userId);

    // Listen for notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[Notification] Received:', notification.request.content.title);
      },
    );

    // Listen for notification taps → deep link
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        handleDeepLink(data);
      },
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function handleDeepLink(data: Record<string, unknown>) {
    const screen = data.screen as string | undefined;

    switch (screen) {
      case 'report':
      case 'area':
        // Navigate to home (areas list) — foreman can tap the area from there
        router.push('/(main)');
        break;
      default:
        // Default: go home
        router.push('/(main)');
        break;
    }
  }

  return <>{children}</>;
}
