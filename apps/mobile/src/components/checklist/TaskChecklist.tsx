/**
 * TaskChecklist — Replaces the percentage slider when reporting_mode = 'checklist'.
 *
 * Reads tasks from local SQLite via PowerSync (offline-first).
 * Foreman taps tasks to mark complete → optimistic update → syncs to Supabase.
 * Progress bar auto-updates from area_trade_status.effective_pct (Zero-Logic UI).
 *
 * Fix 1: Tasks split into two sections:
 *   - Sub tasks: interactive, count toward progress %
 *   - GC Verification: separate purple section, greyed out, does NOT affect %
 *
 * Fix 3: Camera icon per sub task row for optional progress photos.
 *
 * Carlos Standard:
 *   - 56px+ min row height, 32px checkboxes
 *   - High contrast for sunlight readability
 *   - Haptic on toggle
 *   - Alert on gate-blocked attempt (no subtle toasts)
 */

import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert, StyleSheet,
  ActivityIndicator, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera } from 'expo-camera';
import { useReportStore } from '@readyboard/shared';
import { useChecklist } from '@readyboard/shared';
import { usePowerSync } from '@readyboard/shared';
import type { ChecklistTask } from '@readyboard/shared';
import { useAuth } from '../../providers/AuthProvider';
import ChecklistProgress from './ChecklistProgress';
import CorrectionBanner from './CorrectionBanner';
import TaskItem from './TaskItem';
import PhotoCapture from '../report/PhotoCapture';
import { uploadPhoto } from '../../services/uploadPhoto';

export default function TaskChecklist() {
  const { t, i18n } = useTranslation();
  const context = useReportStore((s) => s.context);
  const nextStep = useReportStore((s) => s.nextStep);
  const setProgress = useReportStore((s) => s.setProgress);
  const { session, supabase } = useAuth();
  const { db } = usePowerSync();

  const areaId = context?.area_id ?? '';
  const tradeType = context?.trade_name ?? '';
  const lang = i18n.language;

  const { tasks, progress, isLoading, toggleTask, resubmitTask } = useChecklist(areaId, tradeType);

  // Fix 3: Per-task camera state
  const [cameraTaskId, setCameraTaskId] = useState<string | null>(null);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  // Split tasks into sub and gc sections
  const subTasks = tasks.filter((t) => t.task_owner === 'sub');
  const gcTasks = tasks.filter((t) => t.task_owner === 'gc');

  // Correction detection (sub tasks only)
  const correctionTasks = subTasks.filter((t) => t.status === 'correction_requested');
  const hasCorrectionRequested = correctionTasks.length > 0;
  const correctionReason = correctionTasks[0]?.correction_reason ?? '';
  const correctionNote = correctionTasks[0]?.correction_note ?? null;

  const completedSubCount = subTasks.filter((t) => t.status === 'complete').length;

  const handleToggle = useCallback(
    async (taskId: string) => {
      if (!session?.user.id) return;

      const task = tasks.find((t) => t.id === taskId);
      if (task?.status === 'correction_requested') {
        const result = await resubmitTask(taskId, session.user.id);
        if (result.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        return;
      }

      const result = await toggleTask(taskId, session.user.id, 'sub');

      if (!result.ok && result.error === 'gate_blocked') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('checklist.gateTask'), t('checklist.gateBlocked'));
      }
    },
    [session?.user.id, toggleTask, resubmitTask, tasks, t],
  );

  // Fix 3: Open camera for a specific task
  const handleTaskPhoto = useCallback(async (taskId: string) => {
    const { granted } = await Camera.getCameraPermissionsAsync();
    if (!granted) {
      const { granted: newGranted } = await Camera.requestCameraPermissionsAsync();
      if (!newGranted) return;
    }
    setCameraTaskId(taskId);
  }, []);

  // Fix 3: Capture → compress → upload → save to area_tasks.photo_url
  const handleTaskPhotoCaptured = useCallback(async (uri: string) => {
    const taskId = cameraTaskId;
    setCameraTaskId(null);
    if (!taskId || !session?.user.id) return;

    setUploadingTaskId(taskId);
    try {
      // Compress to 1200px JPEG
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );

      // Upload to Supabase Storage
      const { url } = await uploadPhoto(result.uri, supabase, areaId);

      // Write to local SQLite (PowerSync syncs to Supabase)
      const now = new Date().toISOString();
      await db.execute(
        `UPDATE area_tasks SET photo_url = ?, updated_at = ? WHERE id = ?`,
        [url, now, taskId],
      );
    } catch (err) {
      console.warn('[TaskChecklist] Task photo failed:', err);
    } finally {
      setUploadingTaskId(null);
    }
  }, [cameraTaskId, session?.user.id, supabase, areaId, db]);

  function handleNext() {
    setProgress(Math.round(progress.effective_pct));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    nextStep();
  }

  const renderSubTask = useCallback(
    (item: ChecklistTask) => (
      <TaskItem
        key={item.id}
        task={item}
        userRole="sub"
        lang={lang}
        onToggle={handleToggle}
        onPhoto={handleTaskPhoto}
      />
    ),
    [lang, handleToggle, handleTaskPhoto],
  );

  // Full-screen camera overlay for task photo
  if (cameraTaskId) {
    return (
      <PhotoCapture
        onCapture={handleTaskPhotoCaptured}
        onCancel={() => setCameraTaskId(null)}
      />
    );
  }

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

      {/* Progress bar — SUB tasks only (Zero-Logic UI) */}
      <ChecklistProgress progress={progress} />

      {/* Correction banner */}
      {hasCorrectionRequested && (
        <CorrectionBanner
          reason={correctionReason}
          note={correctionNote}
          taskCount={correctionTasks.length}
        />
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Sub tasks section ──────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('checklist.yourTasks', 'Your tasks')} ({completedSubCount}/{subTasks.length})
          </Text>
        </View>
        {subTasks.map(renderSubTask)}

        {/* Upload indicator for task photo */}
        {uploadingTaskId && (
          <View style={styles.uploadingBanner}>
            <ActivityIndicator size="small" color="#60a5fa" />
            <Text style={styles.uploadingText}>Uploading photo…</Text>
          </View>
        )}

        {/* ── GC Verification section (if any gc tasks) ─────── */}
        {gcTasks.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.sectionHeader}>
              <Text style={styles.gcSectionTitle}>
                {t('checklist.gcVerification', 'GC Verification Required')}
              </Text>
            </View>
            {gcTasks.map((task) => {
              const isVerified = task.status === 'complete';
              return (
                <View
                  key={task.id}
                  style={[styles.gcCard, isVerified && styles.gcCardVerified]}
                >
                  <View style={styles.gcCardRow}>
                    {/* Status indicator */}
                    <View style={[styles.gcDot, isVerified && styles.gcDotVerified]} />
                    <Text style={[styles.gcTaskName, isVerified && styles.gcTaskNameVerified]}>
                      {lang === 'es' ? task.task_name_es : task.task_name_en}
                    </Text>
                  </View>
                  <Text style={[styles.gcStatusLabel, isVerified && styles.gcStatusLabelVerified]}>
                    {isVerified
                      ? t('checklist.verified', '✓ Verified')
                      : t('checklist.awaitingGC', 'Awaiting GC Verification')}
                  </Text>
                  {task.is_gate && !isVerified && (
                    <Text style={styles.gcGateLabel}>
                      {t('checklist.gateTask', 'Gate — Must pass before next trade')}
                    </Text>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* GC notified banner */}
      {progress.gc_verification_pending && (
        <View style={styles.gcNotifiedBanner}>
          <Text style={styles.gcNotifiedIcon}>{'\uD83D\uDC77'}</Text>
          <Text style={styles.gcNotifiedText}>{t('checklist.gcNotified')}</Text>
        </View>
      )}

      {/* Next button */}
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
  scroll: {
    flex: 1,
  },

  // ── Section headers ────────────────────────────────────────
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    letterSpacing: 0.3,
  },
  gcSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#c084fc',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
    marginHorizontal: 4,
  },

  // ── GC verification cards ──────────────────────────────────
  gcCard: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  gcCardVerified: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderLeftColor: '#22c55e',
  },
  gcCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  gcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7c3aed',
  },
  gcDotVerified: {
    backgroundColor: '#22c55e',
  },
  gcTaskName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#c084fc',
    flex: 1,
  },
  gcTaskNameVerified: {
    color: '#86efac',
  },
  gcStatusLabel: {
    fontSize: 12,
    color: '#8b5cf6',
    marginLeft: 16,
    fontStyle: 'italic',
  },
  gcStatusLabelVerified: {
    color: '#4ade80',
    fontStyle: 'normal',
    fontWeight: '600',
  },
  gcGateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 16,
    marginTop: 2,
  },

  // ── Upload indicator ───────────────────────────────────────
  uploadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  uploadingText: {
    fontSize: 12,
    color: '#60a5fa',
  },

  // ── GC notified banner ─────────────────────────────────────
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

  // ── Next button ────────────────────────────────────────────
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
