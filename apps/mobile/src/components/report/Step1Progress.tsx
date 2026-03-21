/**
 * Step 1: How much is done?
 *
 * Large percentage display + slider (0-100%, step 5%).
 * Carlos Standard: huge number center screen, 56px+ next button.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore } from '@readyboard/shared';

export default function Step1Progress() {
  const { t } = useTranslation();
  const progress = useReportStore((s) => s.formData.progress_pct);
  const setProgress = useReportStore((s) => s.setProgress);
  const nextStep = useReportStore((s) => s.nextStep);
  const context = useReportStore((s) => s.context);

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    nextStep();
  }

  function handleSliderChange(value: number) {
    const rounded = Math.round(value / 5) * 5;
    setProgress(rounded);
  }

  return (
    <View style={styles.container}>
      {/* Area context */}
      <Text style={styles.areaName}>{context?.area_name}</Text>
      <Text style={styles.stepTitle}>{t('fieldReport.step1Title')}</Text>

      {/* Big percentage */}
      <View style={styles.percentageContainer}>
        <Text style={styles.percentage}>{progress}</Text>
        <Text style={styles.percentSign}>%</Text>
      </View>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>0%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={5}
          value={progress}
          onValueChange={handleSliderChange}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#334155"
          thumbTintColor="#3b82f6"
        />
        <Text style={styles.sliderLabel}>100%</Text>
      </View>

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
    justifyContent: 'center',
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
    marginBottom: 40,
  },
  percentageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  percentage: {
    fontSize: 96,
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: 96,
  },
  percentSign: {
    fontSize: 36,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    marginLeft: 4,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 48,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#64748b',
    width: 36,
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
