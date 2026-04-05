/**
 * Foreman/Superintendent Home Screen — Areas assigned to the current user.
 *
 * Phase 6: Collapsible Floor → Unit → Area hierarchy.
 * Floors are collapsed by default (except the first). Tap to expand.
 * Each floor header shows aggregate status dots + area count.
 * Each unit header shows per-area status dots.
 *
 * Scales to 2000+ areas without infinite scrolling.
 *
 * Carlos Standard: 56px+ buttons, 20px+ text, high contrast, zero menus.
 */

import { useRef, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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

type UnitGroup = {
  unitKey: string;
  unitLabel: string;
  areas: AssignedArea[];
};

type FloorGroup = {
  floor: string;
  units: UnitGroup[];
  totalAreas: number;
  statusSummary: Record<AreaStatus, number>;
};

function buildStatusSummary(areas: AssignedArea[]): Record<AreaStatus, number> {
  const counts: Record<AreaStatus, number> = { ready: 0, almost: 0, working: 0, held: 0, blocked: 0 };
  for (const a of areas) counts[a.status]++;
  return counts;
}

export default function ForemanHome() {
  const { session } = useAuth();
  const { areas, pendingNods, isLoading, isConnected, error, refresh } = useAreas(session?.user.id);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

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

  // ─── Group areas: Floor → Unit → Areas ──────
  const floors = useMemo<FloorGroup[]>(() => {
    const floorMap = new Map<string, Map<string, AssignedArea[]>>();

    for (const area of areas) {
      const floor = area.floor;
      if (!floorMap.has(floor)) floorMap.set(floor, new Map());
      const unitMap = floorMap.get(floor)!;
      const unitKey = area.unit_name ?? '__common__';
      if (!unitMap.has(unitKey)) unitMap.set(unitKey, []);
      unitMap.get(unitKey)!.push(area);
    }

    return Array.from(floorMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([floor, unitMap]) => {
        const units: UnitGroup[] = Array.from(unitMap.entries())
          .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
          .map(([unitKey, unitAreas]) => ({
            unitKey,
            unitLabel: unitKey === '__common__' ? 'Common' : `Unit ${unitKey}`,
            areas: unitAreas,
          }));

        const allAreas = units.flatMap((u) => u.areas);
        return {
          floor,
          units,
          totalAreas: allAreas.length,
          statusSummary: buildStatusSummary(allAreas),
        };
      });
  }, [areas]);

  // Auto-expand first floor + first unit on initial load
  useMemo(() => {
    if (floors.length > 0 && expandedFloors.size === 0) {
      setExpandedFloors(new Set([floors[0].floor]));
      // Also expand first unit of first floor
      const firstUnit = floors[0].units[0];
      if (firstUnit) setExpandedUnits(new Set([`${floors[0].floor}:${firstUnit.unitKey}`]));
    }
  }, [floors.length > 0]);

  function toggleFloor(floor: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  }

  function toggleUnit(unitKey: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitKey)) next.delete(unitKey);
      else next.add(unitKey);
      return next;
    });
  }

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

      {/* Empty state */}
      {!isLoading && areas.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {error ? t('common.error') : t('common.noAreasAssigned')}
          </Text>
          {error && <Text style={styles.errorDetail}>{error}</Text>}
        </View>
      )}

      {/* Floor → Unit → Area hierarchy */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <NodBanner nods={pendingNods} />

        {floors.map((floorGroup) => {
          const isExpanded = expandedFloors.has(floorGroup.floor);

          return (
            <View key={floorGroup.floor} style={styles.floorContainer}>
              {/* ─── Floor Header (tappable) ─── */}
              <Pressable
                onPress={() => toggleFloor(floorGroup.floor)}
                style={[styles.floorHeader, isExpanded && styles.floorHeaderExpanded]}
              >
                <View style={styles.floorHeaderLeft}>
                  <Text style={styles.floorChevron}>{isExpanded ? '▼' : '▶'}</Text>
                  <Text style={styles.floorTitle}>Floor {floorGroup.floor}</Text>
                  <Text style={styles.floorCount}>{floorGroup.totalAreas}</Text>
                </View>
                {/* Status summary dots */}
                <View style={styles.statusBar}>
                  {(Object.entries(floorGroup.statusSummary) as [AreaStatus, number][])
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => (
                      <View key={status} style={styles.statusChip}>
                        <View style={[styles.statusChipDot, { backgroundColor: STATUS_DOT_COLORS[status] }]} />
                        <Text style={styles.statusChipText}>{count}</Text>
                      </View>
                    ))}
                </View>
              </Pressable>

              {/* ─── Expanded: Units + Areas ─── */}
              {isExpanded &&
                floorGroup.units.map((unit) => {
                  const unitKey = `${floorGroup.floor}:${unit.unitKey}`;
                  const isUnitExpanded = expandedUnits.has(unitKey);
                  return (
                    <View key={unit.unitKey} style={styles.unitContainer}>
                      {/* Unit header — tappable to collapse */}
                      <Pressable style={styles.unitHeader} onPress={() => toggleUnit(unitKey)}>
                        <View style={styles.unitHeaderLeft}>
                          <Text style={styles.unitChevron}>{isUnitExpanded ? '▾' : '▸'}</Text>
                          <Text style={styles.unitTitle}>{unit.unitLabel}</Text>
                          <Text style={styles.unitCount}>{unit.areas.length}</Text>
                        </View>
                        <View style={styles.dotsRow}>
                          {unit.areas.map((a, i) => (
                            <View
                              key={i}
                              style={[styles.statusDot, { backgroundColor: STATUS_DOT_COLORS[a.status] }]}
                            />
                          ))}
                        </View>
                      </Pressable>
                      {/* Area cards — only when unit is expanded */}
                      {isUnitExpanded && unit.areas.map((area) => (
                        <AreaCard
                          key={`${area.id}-${area.trade_name}`}
                          area={area}
                          onReport={handleReport}
                        />
                      ))}
                    </View>
                  );
                })}
            </View>
          );
        })}
      </ScrollView>
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
  // ─── Floor headers (collapsible) ──────────
  floorContainer: {
    marginBottom: 8,
  },
  floorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    minHeight: 56,
  },
  floorHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#1e293b',
  },
  floorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorChevron: {
    fontSize: 12,
    color: '#64748b',
  },
  floorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  floorCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  // ─── Status summary chips ──────────
  statusBar: {
    flexDirection: 'row',
    gap: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  // ─── Unit headers ──────────
  unitContainer: {
    backgroundColor: '#0f172a',
    borderLeftWidth: 2,
    borderLeftColor: '#334155',
    marginLeft: 8,
    paddingLeft: 12,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  unitHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitChevron: {
    fontSize: 11,
    color: '#475569',
  },
  unitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  unitCount: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
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
