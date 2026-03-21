/**
 * Root Layout — Provider chain for ReadyBoard Mobile.
 *
 * Order: I18n → Auth → PowerSync → Routes
 * I18n wraps everything because even login needs translations.
 * Auth wraps PowerSync because the connector needs an active session to sync.
 */

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from '../src/providers/I18nProvider';
import { AuthProvider } from '../src/providers/AuthProvider';
import { PowerSyncMobileProvider } from '../src/providers/PowerSyncProvider';

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <PowerSyncMobileProvider>
          <StatusBar style="light" />
          <Slot />
        </PowerSyncMobileProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
