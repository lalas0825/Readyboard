/**
 * TaskChecklist — Replaces the percentage slider when reporting_mode = 'checklist'.
 *
 * Reads tasks from local SQLite via PowerSync (offline-first).
 * Foreman taps tasks to mark complete → optimistic update → syncs to Supabase.
 * Progress bar auto-updates from area_trade_status.effective_pct (Zero-Logic UI).
 *
 * Carlos Standard:
 *   - 56px+ min row height, 32px checkboxes
 *   - High contrast for sunlight readability
 *   - Haptic on toggle
 *   - Alert on gate-blocked attempt (no subtle toasts)
 */

import { useCallback } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore } from '@readyboard/shared';
import { useChecklist } from '@readyboard/shared';
import type { ChecklistTask } from '@readyboard/shared';
import { useAuth } from '../../providers/AuthProvider';
import ChecklistProgress from './ChecklistProgress';
import CorrectionBanner from './CorrectionBanner';
import TaskItem from './TaskItem';

export default function TaskChecklist() {
  const { t, i18n } = useTranslation();
  const context = useReportStore((s) => s.context);
  const nextStep = useReportStore((s) => s.nextStep);
  const setProgress = useReportStore((s) => s.setProgress);
  const { session } = useAuth();

  const areaId = context?.area_id ?? '';
  const tradeType = context?.trade_name ?? '';
  const lang = i18n.language;

  const { tasks, progress, isLoading, toggleTask, resubmitTask } = useChecklist(areaId, tradeType);

  // Correction detection: aggregate correction tasks for the banner
  const correctionTasks = tasks.filter((t) => t.status === 'correction_requested');
  const hasCorrectionRequested = correctionTasks.length > 0;
  const correctionReason = correctionTasks[0]?.correction_reason ?? '';
  const correctionNote = correctionTasks[0]?.correction_note ?? null;

  const handleToggle = useCallback(
    async (taskId: string) => {
      if (!session?.user.id) return;

      // Check if this is a correction re-submit
      const task = tasks.find((t) => t.id === taskId);
      if (task?.status === 'correction_requested') {
        const result = await resubmitTask(taskId, session.user.id);
        if (result.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      }

      // Foreman mobile app → always 'sub' role
      const result = await toggleTask(taskId, session.user.id, 'sub');

      if (!result.ok && result.error === 'gate_blocked') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          t('checklist.gateTask'),
          t('checklist.gateBlocked'),
        );
      }
    },
    [session?.user.id, toggleTask, resubmitTask, tasks, t],
  );

  function handleNext() {
    // Set the progress_pct in the store from the DB-computed value
    setProgress(Math.round(progress.effective_pct));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    nextStep();
  }

  const renderItem = useCallback(
    ({ item }: { item: ChecklistTask }) => (
      <TaskItem
        task={item}
        userRole="sub"
        lang={lang}
        onToggle={handleToggle}
      />
    ),
    [lang, handleToggle],
  );

  const keyExtractor = useCallback(
    (item: ChecklistTask) => item.id,
    [],
  );

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Area context */}
      <Text style={styles.areaName}>{context?.area_name}</Text>
      <Text style={styles.stepTitle}>{t('checklist.title')}</Text>

      {/* Progress bar (consumes effective_pct from DB — Zero-Logic UI) */}
      <ChecklistProgress progress={progress} />

      {/* Correction banner — persistent until foreman re-submits */}
      {hasCorrectionRequested && (
        <CorrectionBanner
          reason={correctionReason}
          note={correctionNote}
          taskCount={correctionTasks.length}
        />
      )}

      {/* Task list */}
      <FlatList
        data={tasks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* GC notified banner — shows when all SUB tasks done */}
      {progress.gc_verification_pending && (
        <View style={styles.gcNotifiedBanner}>
          <Text style={styles.gcNotifiedIcon}>{'\uD83D\uDC77'}</Text>
          <Text style={styles.gcNotifiedText}>{t('checklist.gcNotified')}</Text>
        </View>
      )}

      {/* Next button → Step 2 (blockers) */}
      <Pressable style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextText}>{t('fieldReport.step2Title')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  areaName: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 8,
  },
  gcNotifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#14532d',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  gcNotifiedIcon: {
    fontSize: 16,
  },
  gcNotifiedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#86efac',
  },
  nextButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nextText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
