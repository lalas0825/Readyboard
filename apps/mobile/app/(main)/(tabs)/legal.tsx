/**
 * Legal Tab — NOD drafts and blocked areas grouped by unit.
 *
 * Phase 5: Groups issues by unit_name so the foreman sees problems
 * organized by physical location (the place where they happen).
 *
 * Carlos Standard: read-only for foreman, status via color.
 */

import { useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, StatusBar, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useAreas, type AssignedArea, type PendingNod } from '@readyboard/shared';

type LegalItem = {
  id: string;
  areaName: string;
  tradeName: string;
  status: 'draft' | 'blocked';
  areaCode: string | null;
};

type LegalSection = {
  title: string;
  data: LegalItem[];
};

export default function LegalTab() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { pendingNods, areas } = useAreas(session?.user.id);

  // Derive blocked areas (potential NOD targets)
  const blockedAreas = areas.filter((a) => a.status === 'blocked');

  // Combine pending NODs + blocked areas, then group by unit
  const sections = useMemo<LegalSection[]>(() => {
    const items: (LegalItem & { unitName: string })[] = [
      ...pendingNods.map((n) => ({
        id: `nod-${n.nod_id}`,
        areaName: n.area_name,
        tradeName: n.reason_code,
        status: 'draft' as const,
        areaCode: n.area_code ?? null,
        unitName: n.unit_name ?? 'Common',
      })),
      ...blockedAreas
        .filter((a) => !pendingNods.some((n) => n.area_name === a.name))
        .map((a) => ({
          id: `blocked-${a.id}-${a.trade_name}`,
          areaName: a.name,
          tradeName: a.trade_name,
          status: 'blocked' as const,
          areaCode: a.area_code ?? null,
          unitName: a.unit_name ?? 'Common',
        })),
    ];

    // Group by unit
    const grouped = new Map<string, LegalItem[]>();
    for (const item of items) {
      const key = item.unitName;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [pendingNods, blockedAreas]);

  const totalItems = sections.reduce((sum, s) => sum + s.data.length, 0);

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.legal')}</Text>
        <Text style={styles.subtitle}>{t('legal.subtitle')}</Text>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.summaryDraft]}>
          <Text style={styles.summaryValue}>{pendingNods.length}</Text>
          <Text style={styles.summaryLabel}>NOD Drafts</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryBlocked]}>
          <Text style={styles.summaryValue}>{blockedAreas.length}</Text>
          <Text style={styles.summaryLabel}>Blocked</Text>
        </View>
      </View>

      {totalItems === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>&#9989;</Text>
          <Text style={styles.emptyTitle}>{t('legal.noIssues')}</Text>
          <Text style={styles.emptySubtitle}>{t('legal.allClear')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {section.title === 'Common' ? 'Common Areas' : `Unit ${section.title}`}
              </Text>
              <Text style={styles.sectionCount}>
                {section.data.length} {section.data.length === 1 ? 'issue' : 'issues'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[
                  styles.statusBadge,
                  item.status === 'draft' ? styles.badgeDraft : styles.badgeBlocked,
                ]}>
                  <Text style={[
                    styles.statusText,
                    item.status === 'draft' ? styles.textDraft : styles.textBlocked,
                  ]}>
                    {item.status === 'draft' ? 'NOD DRAFT' : 'BLOCKED'}
                  </Text>
                </View>
                {item.areaCode && (
                  <View style={styles.cardCodeBadge}>
                    <Text style={styles.cardCodeText}>{item.areaCode}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardArea}>{item.areaName}</Text>
              <Text style={styles.cardTrade}>{item.tradeName}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 4 : 0 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  summaryDraft: {
    backgroundColor: '#1e1b4b',
    borderWidth: 1,
    borderColor: '#6366f120',
  },
  summaryBlocked: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#ef444420',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 4,
  },
  // ─── Section headers (unit grouping) ──────────
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 12,
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
  sectionCount: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  badgeDraft: {
    backgroundColor: '#4338ca20',
    borderColor: '#6366f140',
  },
  badgeBlocked: {
    backgroundColor: '#ef444420',
    borderColor: '#ef444440',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textDraft: { color: '#818cf8' },
  textBlocked: { color: '#ef4444' },
  cardCodeBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardCodeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 0.3,
  },
  cardArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cardTrade: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
