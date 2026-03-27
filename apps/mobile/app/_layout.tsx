/**
 * Root Layout — Provider chain for ReadyBoard Mobile.
 *
 * Order: I18n → Auth → Notifications → PowerSync → Routes
 * I18n wraps everything because even login needs translations.
 * Auth wraps Notifications (needs userId for token registration).
 * Notifications wraps PowerSync (deep links need router context).
 */

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nProvider } from '../src/providers/I18nProvider';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { NotificationProvider } from '../src/providers/NotificationProvider';
import { PowerSyncMobileProvider } from '../src/providers/PowerSyncProvider';

function AuthenticatedProviders() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return (
    <NotificationProvider userId={userId}>
      <PowerSyncMobileProvider>
        <StatusBar style="light" />
        <Slot />
      </PowerSyncMobileProvider>
    </NotificationProvider>
  );
}

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <AuthenticatedProviders />
      </AuthProvider>
    </I18nProvider>
  );
}
