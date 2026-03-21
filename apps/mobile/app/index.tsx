/**
 * Pipeline Status — Placeholder screen.
 *
 * Shows connectivity status to verify the data pipeline works.
 * No real UI — just diagnostic output for development.
 */

import { View, Text, StyleSheet } from 'react-native';
import { usePowerSync } from '@readyboard/shared';
import { useAuth } from '../src/providers/AuthProvider';

export default function PipelineStatus() {
  const { status } = usePowerSync();
  const { session, isLoading } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ReadyBoard</Text>
      <Text style={styles.subtitle}>Data Pipeline Status</Text>

      {/* Auth status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auth</Text>
        <StatusRow
          label="Session"
          value={isLoading ? 'Loading...' : session ? 'Active' : 'None'}
          ok={!!session}
        />
        {session && (
          <StatusRow label="User" value={session.user.id.slice(0, 8) + '...'} ok />
        )}
      </View>

      {/* PowerSync status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PowerSync</Text>
        <StatusRow
          label="Connection"
          value={status.connected ? 'Connected' : 'Offline'}
          ok={status.connected}
        />
        <StatusRow
          label="Last synced"
          value={
            status.lastSyncedAt
              ? status.lastSyncedAt.toLocaleTimeString()
              : 'Never'
          }
          ok={status.hasSynced}
        />
      </View>
    </View>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: ok ? '#22c55e' : '#ef4444' }]} />
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    padding: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 16,
    color: '#94a3b8',
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f8fafc',
  },
});
