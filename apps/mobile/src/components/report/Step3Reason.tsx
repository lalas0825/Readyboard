/**
 * Step 3: Why Blocked? (only if user said "blocked" on Step 2)
 *
 * Reason codes as large icon buttons (56px+).
 * One tap selects reason (highlighted blue border).
 * Optional camera button for photo evidence.
 *
 * Carlos Standard: large icons, one-tap select, color feedback.
 */

import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore, type ReasonCode } from '@readyboard/shared';

const REASON_CODES: { code: ReasonCode; icon: string }[] = [
  { code: 'no_heat', icon: '\uD83C\uDF21' },
  { code: 'prior_trade', icon: '\uD83D\uDD28' },
  { code: 'no_access', icon: '\uD83D\uDEAB' },
  { code: 'inspection', icon: '\uD83D\uDCCB' },
  { code: 'plumbing', icon: '\uD83D\uDD27' },
  { code: 'material', icon: '\uD83D\uDCE6' },
  { code: 'moisture', icon: '\uD83D\uDCA7' },
];

type Props = {
  /** Called when user confirms with a reason selected */
  onReadyToSubmit: () => void;
};

export default function Step3Reason({ onReadyToSubmit }: Props) {
  const { t } = useTranslation();
  const context = useReportStore((s) => s.context);
  const selectedReason = useReportStore((s) => s.formData.reason_code);
  const isSubmitting = useReportStore((s) => s.isSubmitting);
  const setReason = useReportStore((s) => s.setReason);
  const prevStep = useReportStore((s) => s.prevStep);

  function handleSelectReason(code: ReasonCode) {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReason(code);
  }

  function handleSubmit() {
    if (!selectedReason || isSubmitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReadyToSubmit();
  }

  function handleBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prevStep();
  }

  return (
    <View style={styles.container}>
      {/* Context */}
      <Text style={styles.areaName}>{context?.area_name}</Text>
      <Text style={styles.stepTitle}>{t('fieldReport.step3Title')}</Text>

      {/* Reason code grid */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {REASON_CODES.map(({ code, icon }) => {
          const isSelected = selectedReason === code;
          return (
            <Pressable
              key={code}
              style={[styles.reasonCard, isSelected && styles.reasonSelected]}
              onPress={() => handleSelectReason(code)}
            >
              <Text style={styles.reasonIcon}>{icon}</Text>
              <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>
                {t(`reasonCodes.${code}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Submit (disabled until reason selected OR while submitting) */}
      <Pressable
        style={[styles.submitButton, (!selectedReason || isSubmitting) && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={!selectedReason || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>{t('fieldReport.takePhoto')}</Text>
        )}
      </Pressable>

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
    paddingTop: 20,
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
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  reasonCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '45%',
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#172554',
  },
  reasonIcon: {
    fontSize: 32,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  reasonLabelSelected: {
    color: '#93c5fd',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
});
