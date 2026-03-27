/**
 * Report Tab — Entry point for quick report.
 *
 * If no area selected yet, shows "Select an area" message.
 * In the future, this could show recent reports or quick-access areas.
 * For now, guides the user to pick an area from My Areas tab first.
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore } from '@readyboard/shared';

export default function ReportTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const isActive = useReportStore((s) => s.isActive);

  // If a report is already active (started from AreaCard), go to report flow
  if (isActive) {
    router.replace('/(main)/report');
    return null;
  }

  function handleGoToAreas() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(main)/(tabs)');
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>&#128221;</Text>
      </View>
      <Text style={styles.title}>{t('fieldReport.title')}</Text>
      <Text style={styles.subtitle}>
        {t('fieldReport.selectAreaFirst')}
      </Text>
      <Pressable style={styles.button} onPress={handleGoToAreas}>
        <Text style={styles.buttonText}>{t('tabs.myAreas')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#f59e0b40',
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
});
