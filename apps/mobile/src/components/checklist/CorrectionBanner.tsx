/**
 * CorrectionBanner — Persistent orange banner shown when GC has requested corrections.
 *
 * Displays the reason and optional note from the GC.
 * Appears at the top of TaskChecklist, above the task list.
 * Not dismissible — stays until foreman re-submits corrected tasks.
 *
 * Carlos Standard: 56px+ height, 18px+ text, high contrast orange on dark.
 */

import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

type Props = {
  reason: string;
  note: string | null;
  taskCount: number;
};

export default function CorrectionBanner({ reason, note, taskCount }: Props) {
  const { t } = useTranslation();

  // Map reason code to localized label
  const reasonLabel =
    t(`checklist.correctionReasons.${reason}`, { defaultValue: reason });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>!</Text>
        <Text style={styles.title}>
          {t('checklist.correctionBannerTitle', { count: taskCount })}
        </Text>
      </View>
      <Text style={styles.reason}>{reasonLabel}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <Text style={styles.instruction}>{t('checklist.correctionBannerAction')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#431407',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f97316',
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f97316',
    width: 24,
    height: 24,
    textAlign: 'center',
    lineHeight: 24,
    backgroundColor: '#7c2d12',
    borderRadius: 12,
    overflow: 'hidden',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fdba74',
    flex: 1,
  },
  reason: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fb923c',
    marginLeft: 32,
  },
  note: {
    fontSize: 14,
    color: '#fed7aa',
    marginLeft: 32,
    fontStyle: 'italic',
  },
  instruction: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fdba74',
    marginLeft: 32,
    marginTop: 4,
  },
});
