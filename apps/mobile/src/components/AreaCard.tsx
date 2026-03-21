/**
 * AreaCard — Single area card for Foreman Home Screen.
 *
 * Shows area name, floor, trade, progress, and color-coded status chip.
 * "Report Update" button: 56px height, haptic feedback.
 *
 * Carlos Standard: large text, high contrast, color does the talking.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import type { AssignedArea, AreaStatus } from '@readyboard/shared';

const STATUS_CONFIG: Record<AreaStatus, { color: string; bg: string; label: string }> = {
  ready:   { color: '#22c55e', bg: '#052e16', label: 'readyBoard.statusReady' },
  almost:  { color: '#eab308', bg: '#422006', label: 'readyBoard.statusAlmost' },
  working: { color: '#3b82f6', bg: '#172554', label: 'readyBoard.statusWorking' },
  blocked: { color: '#ef4444', bg: '#450a0a', label: 'readyBoard.statusBlocked' },
  held:    { color: '#a855f7', bg: '#3b0764', label: 'readyBoard.statusHeld' },
};

type Props = {
  area: AssignedArea;
  onReport: (area: AssignedArea) => void;
};

/** Check if timestamp is within last 2 hours */
function isRecentlyReported(isoTimestamp: string | null): boolean {
  if (!isoTimestamp) return false;
  const reported = new Date(isoTimestamp).getTime();
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  return reported > twoHoursAgo;
}

export default function AreaCard({ area, onReport }: Props) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[area.status];
  const recentlyReported = isRecentlyReported(area.last_report_at);

  function handleReport() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReport(area);
  }

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      {/* Header: Name + Status chip */}
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{area.name}</Text>
            {recentlyReported && (
              <View style={styles.reportedBadge}>
                <Text style={styles.reportedCheck}>{'\u2713'}</Text>
                <Text style={styles.reportedText}>{t('fieldReport.reported')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta}>
            {area.floor} · {t(`trades.${area.trade_name}`, { defaultValue: area.trade_name })}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: config.bg }]}>
          <View style={[styles.chipDot, { backgroundColor: config.color }]} />
          <Text style={[styles.chipText, { color: config.color }]}>
            {t(config.label)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(area.effective_pct, 100)}%`,
                backgroundColor: config.color,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{Math.round(area.effective_pct)}%</Text>
      </View>

      {/* Report Update button */}
      <Pressable style={styles.reportButton} onPress={handleReport}>
        <Text style={styles.reportText}>{t('fieldReport.reportUpdate')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleArea: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    flexShrink: 1,
  },
  reportedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#052e16',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 3,
  },
  reportedCheck: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '700',
  },
  reportedText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '600',
  },
  meta: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 6,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    width: 40,
    textAlign: 'right',
  },
  reportButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
