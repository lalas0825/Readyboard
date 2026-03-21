/**
 * Step 2: Any Blockers?
 *
 * Two full-width buttons:
 *   Green "No blockers" → status=working → ready to submit
 *   Red "Yes, blocked" → go to Step 3 for reason code
 *
 * Carlos Standard: color does the talking, 56px+ buttons.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore } from '@readyboard/shared';

type Props = {
  /** Called when user selects "No blockers" — ready to submit */
  onReadyToSubmit: () => void;
};

export default function Step2Blockers({ onReadyToSubmit }: Props) {
  const { t } = useTranslation();
  const context = useReportStore((s) => s.context);
  const progress = useReportStore((s) => s.formData.progress_pct);
  const isSubmitting = useReportStore((s) => s.isSubmitting);
  const setBlockers = useReportStore((s) => s.setBlockers);
  const nextStep = useReportStore((s) => s.nextStep);
  const prevStep = useReportStore((s) => s.prevStep);

  function handleNoBlockers() {
    if (isSubmitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBlockers(false);
    onReadyToSubmit();
  }

  function handleHasBlockers() {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBlockers(true);
    nextStep();
  }

  function handleBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prevStep();
  }

  return (
    <View style={styles.container}>
      {/* Context */}
      <Text style={styles.areaName}>{context?.area_name}</Text>
      <Text style={styles.progressLabel}>{progress}%</Text>
      <Text style={styles.stepTitle}>{t('fieldReport.step2Title')}</Text>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <Pressable
          style={[styles.greenButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleNoBlockers}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonIcon}>{'\u2713'}</Text>
          <Text style={styles.buttonText}>{t('fieldReport.noBlockers')}</Text>
        </Pressable>

        <Pressable
          style={[styles.redButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleHasBlockers}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonIcon}>{'\u2717'}</Text>
          <Text style={styles.buttonText}>{t('fieldReport.hasBlockers')}</Text>
        </Pressable>
      </View>

      {/* Back */}
      <Pressable style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  areaName: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  greenButton: {
    backgroundColor: '#166534',
    borderRadius: 16,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  redButton: {
    backgroundColor: '#991b1b',
    borderRadius: 16,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonIcon: {
    fontSize: 28,
    color: '#fff',
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});
