/**
 * Pipeline Status — Observability + Offline Test Screen (Fase 4)
 *
 * Shows detailed sync status, pending upload count, error details,
 * and a test button to create field reports for offline validation.
 */

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { usePowerSync, useFieldReport } from '@readyboard/shared';
import { useAuth } from '../src/providers/AuthProvider';

export default function PipelineStatus() {
  const { db, status } = usePowerSync();
  const { session, isLoading: authLoading } = useAuth();
  const { createReport, getReportsForArea } = useFieldReport();

  const [pendingCount, setPendingCount] = useState(0);
  const [localReports, setLocalReports] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [testLog, setTestLog] = useState<string[]>([]);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setTestLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 20));
    console.log(`[PipelineTest] ${msg}`);
  }, []);

  // Poll pending uploads + local report count every 2s
  useEffect(() => {
    const poll = async () => {
      try {
        const crud = await db.getAll<{ count: number }>(
          'SELECT count(*) as count FROM ps_crud'
        );
        setPendingCount(crud[0]?.count ?? 0);
      } catch {
        // ps_crud table may not exist until first write
      }

      try {
        const reports = await db.getAll<{ count: number }>(
          'SELECT count(*) as count FROM field_reports'
        );
        setLocalReports(reports[0]?.count ?? 0);
      } catch {
        // Table may not exist until schema is applied
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [db]);

  // Track sync errors
  useEffect(() => {
    const dispose = db.registerListener({
      statusChanged: (syncStatus) => {
        const uploadError = (syncStatus as unknown as Record<string, unknown>).uploadError as
          | { message?: string }
          | undefined;
        if (uploadError) {
          const errMsg = uploadError.message ?? String(uploadError);
          setLastError(errMsg);
          log(`SYNC ERROR: ${errMsg}`);
        } else if (lastError && syncStatus.connected) {
          setLastError(null);
          log('Sync recovered — error cleared');
        }
      },
    });
    return () => {
      if (typeof dispose === 'function') dispose();
    };
  }, [db, lastError, log]);

  // Derive sync status label
  const syncLabel = (() => {
    if (lastError) return 'Error';
    if (!status.connected) return 'Offline';
    if (pendingCount > 0) return 'Syncing';
    if (status.hasSynced) return 'Connected';
    return 'Connecting...';
  })();

  const syncColor =
    syncLabel === 'Error'
      ? '#ef4444'
      : syncLabel === 'Offline'
        ? '#f59e0b'
        : syncLabel === 'Syncing'
          ? '#3b82f6'
          : '#22c55e';

  // Create a test field report
  async function handleCreateTestReport() {
    try {
      log('Creating test field report...');
      const id = await createReport({
        area_id: 'test-area-001',
        user_id: session?.user.id ?? 'offline-user',
        trade_name: 'tile',
        status: 'working',
        progress_pct: 45,
      });
      log(`Report created: ${id}`);

      // Verify it exists locally
      const reports = await getReportsForArea('test-area-001');
      log(`Local reports for test-area-001: ${reports.length}`);

      Alert.alert('Report Created', `ID: ${id}\nPending sync: check status below`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      log(`CREATE FAILED: ${msg}`);
      Alert.alert('Error', msg);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>ReadyBoard</Text>
      <Text style={styles.subtitle}>Data Pipeline — Fase 4</Text>

      {/* Auth Section */}
      <Section title="Auth">
        <StatusRow
          label="Session"
          value={authLoading ? 'Loading...' : session ? 'Active' : 'None'}
          ok={!!session}
        />
        {session && (
          <StatusRow label="User" value={session.user.id.slice(0, 12) + '...'} ok />
        )}
      </Section>

      {/* Sync Section */}
      <Section title="PowerSync">
        <View style={styles.row}>
          <View style={[styles.bigDot, { backgroundColor: syncColor }]} />
          <Text style={styles.syncLabel}>{syncLabel}</Text>
        </View>
        <StatusRow
          label="Last synced"
          value={status.lastSyncedAt?.toLocaleTimeString() ?? 'Never'}
          ok={status.hasSynced}
        />
        <StatusRow
          label="Pending uploads"
          value={String(pendingCount)}
          ok={pendingCount === 0}
        />
        <StatusRow
          label="Local field_reports"
          value={String(localReports)}
          ok
        />
        {lastError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Last Error</Text>
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}
      </Section>

      {/* Test Actions */}
      <Section title="Offline Test">
        <Pressable style={styles.button} onPress={handleCreateTestReport}>
          <Text style={styles.buttonText}>Create Test Report</Text>
        </Pressable>
        <Text style={styles.hint}>
          1. Tap button → creates field_report in local SQLite{'\n'}
          2. Toggle airplane mode → verify pending count increases{'\n'}
          3. Reconnect → verify pending count drops to 0{'\n'}
          4. Check Supabase dashboard for the synced row
        </Text>
      </Section>

      {/* Live Log */}
      <Section title="Log">
        {testLog.length === 0 ? (
          <Text style={styles.logEmpty}>No events yet</Text>
        ) : (
          testLog.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>
              {entry}
            </Text>
          ))
        )}
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
  scroll: { flex: 1, backgroundColor: '#0f172a' },
  container: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#f8fafc', marginBottom: 2 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 28 },
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
  label: { fontSize: 14, color: '#94a3b8' },
  value: { fontSize: 14, fontWeight: '500', color: '#f8fafc' },
  errorBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  errorTitle: { fontSize: 12, fontWeight: '600', color: '#fca5a5', marginBottom: 4 },
  errorText: { fontSize: 12, color: '#fecaca', fontFamily: 'monospace' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  logEmpty: { fontSize: 12, color: '#475569', fontStyle: 'italic' },
  logEntry: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 4 },
});
