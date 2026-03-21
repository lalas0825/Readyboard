/**
 * DebugNav — Dev-only observability panel.
 *
 * Shows Auth (userId, phone, session expiry), i18n (locale + toggle),
 * and PowerSync (connection status, last synced, pending uploads).
 *
 * Only renders in __DEV__. Production returns null.
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { usePowerSync } from '@readyboard/shared';
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@readyboard/shared';
import { useAuth } from '../providers/AuthProvider';
import { changeLanguage } from '../providers/I18nProvider';

export default function DebugNav() {
  if (!__DEV__) return null;

  const { session } = useAuth();
  const { db, status } = usePowerSync();
  const { i18n } = useTranslation();
  const router = useRouter();

  const [pendingCount, setPendingCount] = useState(0);

  // Poll pending uploads
  useEffect(() => {
    const poll = async () => {
      try {
        const crud = await db.getAll<{ count: number }>(
          'SELECT count(*) as count FROM ps_crud'
        );
        setPendingCount(crud[0]?.count ?? 0);
      } catch {
        // ps_crud may not exist yet
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [db]);

  const expiresAt = session?.expires_at
    ? new Date(session.expires_at * 1000)
    : null;
  const expiresIn = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000))
    : null;

  async function handleToggleLanguage() {
    const current = i18n.language as SupportedLocale;
    const next = SUPPORTED_LOCALES.find((l) => l !== current) ?? 'en';
    await changeLanguage(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Panel</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>

      {/* Auth */}
      <Section title="Auth">
        <Row label="Session" value={session ? 'Active' : 'None'} ok={!!session} />
        {session && (
          <>
            <Row label="User ID" value={session.user.id} ok />
            <Row label="Phone" value={session.user.phone ?? 'n/a'} ok={!!session.user.phone} />
            <Row
              label="Expires in"
              value={expiresIn != null ? `${expiresIn}s` : 'n/a'}
              ok={expiresIn != null && expiresIn > 300}
            />
            {expiresAt && (
              <Row label="Expires at" value={expiresAt.toLocaleTimeString()} ok />
            )}
          </>
        )}
      </Section>

      {/* i18n */}
      <Section title="i18n">
        <Row label="Active locale" value={i18n.language} ok />
        <Pressable style={styles.toggleButton} onPress={handleToggleLanguage}>
          <Text style={styles.toggleText}>
            Toggle → {SUPPORTED_LOCALES.find((l) => l !== i18n.language) ?? 'en'}
          </Text>
        </Pressable>
      </Section>

      {/* PowerSync */}
      <Section title="PowerSync">
        <View style={styles.row}>
          <View
            style={[
              styles.bigDot,
              { backgroundColor: status.connected ? '#22c55e' : '#ef4444' },
            ]}
          />
          <Text style={styles.syncLabel}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
        <Row
          label="Last synced"
          value={status.lastSyncedAt?.toLocaleTimeString() ?? 'Never'}
          ok={status.hasSynced}
        />
        <Row label="Has synced" value={String(status.hasSynced)} ok={status.hasSynced} />
        <Row
          label="Pending uploads"
          value={String(pendingCount)}
          ok={pendingCount === 0}
        />
      </Section>

      {/* Environment */}
      <Section title="Environment">
        <Row label="__DEV__" value={String(__DEV__)} ok={__DEV__} />
        <Row label="Platform" value={require('react-native').Platform.OS} ok />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: ok ? '#22c55e' : '#ef4444' }]} />
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0f172a' },
  container: { padding: 24, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  closeText: { fontSize: 16, color: '#3b82f6', fontWeight: '500' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bigDot: { width: 14, height: 14, borderRadius: 7 },
  syncLabel: { fontSize: 20, fontWeight: '700', color: '#f8fafc' },
  label: { fontSize: 14, color: '#94a3b8', flexShrink: 0 },
  value: { fontSize: 14, fontWeight: '500', color: '#f8fafc', flex: 1 },
  toggleButton: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  toggleText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
});
