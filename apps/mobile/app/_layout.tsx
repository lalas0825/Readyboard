/**
 * Root Layout — Provider chain for ReadyBoard Mobile.
 *
 * Order: Auth → PowerSync → Routes
 * Auth wraps PowerSync because the connector needs an active session to sync.
 */

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/providers/AuthProvider';
import { PowerSyncMobileProvider } from '../src/providers/PowerSyncProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PowerSyncMobileProvider>
        <StatusBar style="light" />
        <Slot />
      </PowerSyncMobileProvider>
    </AuthProvider>
  );
}
