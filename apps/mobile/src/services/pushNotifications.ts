/**
 * Push Notification Registration — Expo Push Notifications.
 *
 * Flow:
 * 1. Check device (must be physical, not simulator)
 * 2. Request permission
 * 3. Get Expo Push Token
 * 4. Save token to users.push_token in Supabase
 *
 * Token format: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// ─── Configure notification behavior ────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Registration ───────────────────────────────────

/**
 * Registers the device for push notifications and saves the token.
 * Returns the token string or null if registration failed.
 */
export async function registerForPushNotificationsAsync(
  userId: string,
): Promise<string | null> {
  // Physical device check (simulators can't receive push)
  if (!Device.isDevice) {
    console.log('[Push] Skipping registration on simulator');
    return null;
  }

  // Android: create notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ReadyBoard',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f59e0b',
    });
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not determined
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permission denied');
    return null;
  }

  // Get Expo Push Token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
      ?? Constants.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenResponse.data;
    console.log('[Push] Token:', token);

    // Save to Supabase
    await saveTokenToSupabase(userId, token);

    return token;
  } catch (error) {
    console.error('[Push] Token registration failed:', error);
    return null;
  }
}

/**
 * Saves the push token to users.push_token via Supabase.
 */
async function saveTokenToSupabase(userId: string, token: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('[Push] Failed to save token:', error.message);
    } else {
      console.log('[Push] Token saved for user:', userId);
    }
  } catch (err) {
    console.error('[Push] saveTokenToSupabase error:', err);
  }
}

/**
 * Clears the push token from Supabase (call on logout).
 */
export async function clearPushToken(userId: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await supabase
      .from('users')
      .update({ push_token: null })
      .eq('id', userId);
  } catch {
    // Silent — logout should never be blocked by token cleanup
  }
}

/**
 * Checks if push notifications are enabled.
 */
export async function isPushEnabled(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
