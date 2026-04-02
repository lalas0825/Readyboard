/**
 * Foreman Home Screen — Areas assigned to the current user.
 *
 * Phase 5: SectionList grouped by unit_name with aggregate status dots.
 * Each section header shows "Unit 24A" with colored dots per area status.
 * Areas without a unit are grouped under "Common".
 *
 * NOD Banner: sticky purple banner when unsent NOD drafts exist.
 * Triple-tap on title → navigates to /debug (dev-only).
 * Offline indicator: subtle dot in header when PowerSync disconnected.
 *
 * Carlos Standard: 56px+ buttons, 20px+ text, high contrast, zero menus.
 */

import { useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAreas, useReportStore, type AssignedArea, type AreaStatus } from '@readyboard/shared';
import { useAuth } from '../../../src/providers/AuthProvider';
import AreaCard from '../../../src/components/AreaCard';
import NodBanner from '../../../src/components/NodBanner';

// ─── Status dot colors ──────────────────────────────
const STATUS_DOT_COLORS: Record<AreaStatus, string> = {
  ready: '#22c55e',
  almost: '#eab308',
  working: '#3b82f6',
  held: '#a855f7',
  blocked: '#ef4444',
};

type UnitSection = {
  title: string;
  data: AssignedArea[];
  statusDots: { color: string }[];
};

/** Build colored dots summarizing area statuses in a unit */
function buildStatusDots(areas: AssignedArea[]): { color: string }[] {
  return areas.map((a) => ({ color: STATUS_DOT_COLORS[a.status] }));
}

export default function ForemanHome() {
  const { session } = useAuth();
  const { areas, pendingNods, isLoading, isConnected, error, refresh } = useAreas(session?.user.id);

  // Instant refresh when screen regains focus (after report submit, back navigation, etc.)
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  const { t } = useTranslation();
  const router = useRouter();

  // Triple-tap on title → debug screen
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleTitlePress() {
    tapCountRef.current++;
    clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      router.push('/debug');
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 500);
    }
  }

  const startReport = useReportStore((s) => s.startReport);

  function handleReport(area: AssignedArea) {
    startReport({
      area_id: area.id,
      area_name: area.name,
      floor: area.floor,
      trade_name: area.trade_name,
      user_id: session!.user.id,
      reporting_mode: area.reporting_mode,
      area_code: area.area_code,
      area_description: area.description,
      unit_name: area.unit_name,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/report');
  }

  // ─── Group areas by Floor → Unit ──────
  const sections = useMemo<UnitSection[]>(() => {
    const grouped = new Map<string, AssignedArea[]>();
    for (const area of areas) {
      const unit = area.unit_name ?? 'Common';
      const key = `F${area.floor} · ${unit === 'Common' ? 'Common' : `Unit ${unit}`}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(area);
      } else {
        grouped.set(key, [area]);
      }
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([title, data]) => ({
        title,
        data,
        statusDots: buildStatusDots(data),
      }));
  }, [areas]);

  const renderItem = useCallback(
    ({ item }: { item: AssignedArea }) => (
      <AreaCard area={item} onReport={handleReport} />
    ),
    []
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: UnitSection }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {section.title}
        </Text>
        {/* Status dots: one per area, colored by status */}
        <View style={styles.dotsRow}>
          {section.statusDots.map((dot, i) => (
            <View
              key={i}
              style={[styles.statusDot, { backgroundColor: dot.color }]}
            />
          ))}
        </View>
      </View>
    ),
    []
  );

  const keyExtractor = useCallback(
    (item: AssignedArea) => `${item.id}-${item.trade_name}`,
    []
  );

  const ListHeader = useCallback(
    () => (
      <>
        <NodBanner nods={pendingNods} />
      </>
    ),
    [pendingNods]
  );

  const ListEmpty = useCallback(
    () =>
      isLoading ? null : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {error ? t('common.error') : t('common.noAreasAssigned')}
          </Text>
          {error && (
            <Text style={styles.errorDetail}>{error}</Text>
          )}
        </View>
      ),
    [isLoading, error, t]
  );

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={handleTitlePress}>
            <Text style={styles.title}>{t('common.appName')}</Text>
          </Pressable>
          <View style={styles.syncRow}>
            <View
              style={[
                styles.syncDot,
                { backgroundColor: isConnected ? '#22c55e' : '#f59e0b' },
              ]}
            />
            <Text style={styles.syncText}>
              {isConnected ? t('common.synced') : t('common.offline')}
            </Text>
          </View>
        </View>
        <Text style={styles.areaCount}>{areas.length} {t('tabs.myAreas').toLowerCase()}</Text>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* Area list grouped by unit */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 4 : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  areaCount: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  // ─── Section headers (unit grouping) ──────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    maxWidth: 120,
    justifyContent: 'flex-end',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // ─── Empty + Error ──────────
  empty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
  },
  errorDetail: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'monospace',
    paddingHorizontal: 20,
  },
});
