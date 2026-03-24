/**
 * TaskItem — Single row in the foreman checklist.
 *
 * Visual rules:
 *   SUB task: tappable checkbox, green when complete
 *   GC task: greyed out, "Awaiting GC" label — NOT tappable by foreman
 *   Gate task: shield icon, distinct border
 *   Correction requested: orange highlight, correction reason shown
 *
 * Carlos Standard:
 *   - Tap target: minimum 56px height
 *   - Font: 18px+ for task name, high contrast (#f8fafc on dark)
 *   - Haptic on complete
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import type { ChecklistTask } from '@readyboard/shared';

type Props = {
  task: ChecklistTask;
  userRole: 'sub' | 'gc';
  lang: string;
  onToggle: (taskId: string) => void;
};

export default function TaskItem({ task, userRole, lang, onToggle }: Props) {
  const { t } = useTranslation();
  const taskName = lang === 'es' ? task.task_name_es : task.task_name_en;
  const isComplete = task.status === 'complete';
  const isCorrectionRequested = task.status === 'correction_requested';
  const isGCTask = task.task_owner === 'gc';
  // Correction tasks are always tappable by sub (re-submit action)
  const canInteract = isCorrectionRequested
    ? task.task_owner === 'sub'
    : isGCTask
      ? userRole === 'gc'
      : userRole === 'sub' || userRole === 'gc';

  function handlePress() {
    if (!canInteract) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle(task.id);
  }

  return (
    <Pressable
      style={[
        styles.container,
        task.is_gate && styles.gateContainer,
        isCorrectionRequested && styles.correctionContainer,
      ]}
      onPress={handlePress}
      disabled={!canInteract}
    >
      {/* Checkbox */}
      <View
        style={[
          styles.checkbox,
          isComplete && styles.checkboxComplete,
          isGCTask && !isComplete && styles.checkboxGC,
          isCorrectionRequested && styles.checkboxCorrection,
        ]}
      >
        {isComplete && <Text style={styles.checkmark}>{'\u2713'}</Text>}
        {isCorrectionRequested && <Text style={styles.correctionMark}>!</Text>}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          {task.is_gate && <Text style={styles.gateIcon}>{'\uD83D\uDEE1\uFE0F'}</Text>}
          <Text
            style={[
              styles.taskName,
              isComplete && styles.taskNameComplete,
              !canInteract && styles.taskNameDisabled,
            ]}
            numberOfLines={2}
          >
            {taskName}
          </Text>
        </View>

        {/* Sub-labels */}
        {isGCTask && !isComplete && (
          <Text style={styles.awaitingLabel}>{t('checklist.awaitingGC')}</Text>
        )}
        {task.is_gate && !isComplete && (
          <Text style={styles.gateLabel}>{t('checklist.gateTask')}</Text>
        )}
        {isCorrectionRequested && task.correction_reason && (
          <Text style={styles.correctionLabel}>
            {t(`checklist.correctionReasons.${task.correction_reason}`, {
              defaultValue: task.correction_reason,
            })}
          </Text>
        )}
        {isCorrectionRequested && task.task_owner === 'sub' && (
          <Text style={styles.resubmitLabel}>{t('checklist.tapToResubmit')}</Text>
        )}
      </View>

      {/* Weight badge */}
      <Text style={styles.weight}>{Math.round(task.weight)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  gateContainer: {
    backgroundColor: '#1e293b',
    borderLeftWidth: 3,
    borderLeftColor: '#eab308',
  },
  correctionContainer: {
    backgroundColor: '#431407',
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },

  // Checkbox — 32px for gloved fingers (inside 56px row)
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxComplete: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkboxGC: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  checkboxCorrection: {
    backgroundColor: '#7c2d12',
    borderColor: '#f97316',
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  correctionMark: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
  },

  // Content
  content: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gateIcon: {
    fontSize: 16,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f8fafc',
    flex: 1,
  },
  taskNameComplete: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  taskNameDisabled: {
    color: '#64748b',
  },

  // Sub-labels
  awaitingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    fontStyle: 'italic',
  },
  gateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#eab308',
  },
  correctionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fb923c',
  },
  resubmitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
    marginTop: 2,
  },

  // Weight badge
  weight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    minWidth: 24,
    textAlign: 'right',
  },
});
