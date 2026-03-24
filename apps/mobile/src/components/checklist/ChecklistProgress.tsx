/**
 * ChecklistProgress — Visual progress bar consuming effective_pct from DB.
 *
 * Zero-Logic UI: No percentage calculation here.
 * The value comes pre-computed from area_trade_status via calculate_effective_pct trigger.
 *
 * Shows: effective_pct bar + GC verification pending badge.
 * Carlos Standard: high contrast, large text, readable under sunlight.
 */

import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TradeProgress } from '@readyboard/shared';

type Props = {
  progress: TradeProgress;
};

export default function ChecklistProgress({ progress }: Props) {
  const { t } = useTranslation();
  const pct = Math.round(progress.effective_pct);
  const barColor = progress.all_gates_passed ? '#22c55e' : '#eab308';

  return (
    <View style={styles.container}>
      {/* Percentage display */}
      <View style={styles.row}>
        <Text style={styles.pctText}>{pct}%</Text>
        {!progress.all_gates_passed && (
          <Text style={styles.gateBadge}>{'\u26D4'}</Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor },
          ]}
        />
      </View>

      {/* GC verification pending */}
      {progress.gc_verification_pending && (
        <View style={styles.gcBadge}>
          <Text style={styles.gcBadgeIcon}>{'\uD83D\uDC77'}</Text>
          <Text style={styles.gcBadgeText}>{t('checklist.awaitingGC')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pctText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f8fafc',
  },
  gateBadge: {
    fontSize: 20,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  gcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#422006',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  gcBadgeIcon: {
    fontSize: 14,
  },
  gcBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fbbf24',
  },
});
