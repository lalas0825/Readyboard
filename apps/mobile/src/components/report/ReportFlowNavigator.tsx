/**
 * ReportFlowNavigator — Orchestrates the 3-step report flow + success screen.
 *
 * Renders the current step based on useReportStore.currentStep.
 * When isSubmitted, renders a full-screen success confirmation.
 *
 * Carlos Standard: green checkmark, large text, single close button.
 */

import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore } from '@readyboard/shared';
import Step1Progress from './Step1Progress';
import Step2Blockers from './Step2Blockers';
import Step3Reason from './Step3Reason';
import TaskChecklist from '../checklist/TaskChecklist';

type Props = {
  /** Called when the flow is ready to submit */
  onSubmit: () => void;
  /** Called when user taps Close on success screen */
  onClose: () => void;
};

export default function ReportFlowNavigator({ onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const currentStep = useReportStore((s) => s.currentStep);
  const isSubmitted = useReportStore((s) => s.isSubmitted);
  const reset = useReportStore((s) => s.reset);
  const context = useReportStore((s) => s.context);

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    router.back();
  }

  // Success screen — full-screen green confirmation
  if (isSubmitted) {
    return (
      <SafeAreaView style={styles.successSafe}>
        <View style={styles.successContent}>
          <Text style={styles.successCheck}>{'\u2713'}</Text>
          <Text style={styles.successTitle}>{t('fieldReport.reportSent')}</Text>
          {context && (
            <>
              {context.area_code && (
                <View style={styles.successCodeBadge}>
                  <Text style={styles.successCodeText}>{context.area_code}</Text>
                </View>
              )}
              <Text style={styles.successArea}>
                {context.area_name} — {context.trade_name}
              </Text>
              {context.unit_name && (
                <Text style={styles.successUnit}>Unit {context.unit_name}</Text>
              )}
            </>
          )}
          <Text style={styles.successSubtitle}>
            {t('fieldReport.reportSentSubtitle')}
          </Text>
        </View>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={12}
        >
          <Text style={styles.closeButtonText}>{t('common.close')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar: cancel + area context + progress dots */}
      <View style={styles.topBar}>
        <Pressable onPress={handleCancel} hitSlop={12}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </Pressable>

        {/* Area code + name context — the foreman's north star */}
        <View style={styles.topBarContext}>
          {context?.area_code && (
            <View style={styles.topBarCodeBadge}>
              <Text style={styles.topBarCodeText}>{context.area_code}</Text>
            </View>
          )}
          <Text style={styles.topBarAreaName} numberOfLines={1}>
            {context?.area_name ?? ''}
          </Text>
        </View>

        <View style={styles.dots}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.dot,
                currentStep >= step ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Step content — checklist replaces slider when reporting_mode = 'checklist' */}
      {currentStep === 1 && (
        context?.reporting_mode === 'checklist' ? <TaskChecklist /> : <Step1Progress />
      )}
      {currentStep === 2 && <Step2Blockers onReadyToSubmit={onSubmit} />}
      {currentStep === 3 && <Step3Reason onReadyToSubmit={onSubmit} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: '#3b82f6',
  },
  dotInactive: {
    backgroundColor: '#334155',
  },
  spacer: {
    width: 60,
  },
  // ─── Top bar area context ──────────
  topBarContext: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 8,
  },
  topBarCodeBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  topBarCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.3,
  },
  topBarAreaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    flexShrink: 1,
  },
  // Success screen styles — Carlos Standard: loud confirmation
  successSafe: {
    flex: 1,
    backgroundColor: '#166534',
    justifyContent: 'space-between',
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successCheck: {
    fontSize: 80,
    color: '#ffffff',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  successArea: {
    fontSize: 18,
    fontWeight: '500',
    color: '#bbf7d0',
    textAlign: 'center',
    marginBottom: 4,
  },
  successUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#86efac',
    textAlign: 'center',
    marginBottom: 8,
  },
  successCodeBadge: {
    backgroundColor: 'rgba(134, 239, 172, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  successCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: '#86efac',
    letterSpacing: 1,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#86efac',
    textAlign: 'center',
  },
  closeButton: {
    height: 56,
    marginHorizontal: 24,
    marginBottom: 32,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#166534',
  },
});
