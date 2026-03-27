/**
 * Legal Tab — NOD drafts and legal document status.
 *
 * Shows pending NOD drafts that need GC review,
 * sent NODs, and overall legal status summary.
 *
 * Carlos Standard: read-only for foreman, status via color.
 */

import { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../src/providers/AuthProvider';
import { useAreas } from '@readyboard/shared';

type NodItem = {
  id: string;
  areaName: string;
  tradeName: string;
  status: string;
};

export default function LegalTab() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { pendingNods, areas } = useAreas(session?.user.id);

  // Derive blocked areas (potential NOD targets)
  const blockedAreas = areas.filter((a) => a.status === 'blocked');

  // Combine pending NODs + blocked areas for display
  const items: NodItem[] = [
    ...pendingNods.map((n) => ({
      id: `nod-${n.nod_id}`,
      areaName: n.area_name,
      tradeName: n.reason_code,
      status: 'draft',
    })),
    ...blockedAreas
      .filter((a) => !pendingNods.some((n) => n.area_name === a.name))
      .map((a) => ({
        id: `blocked-${a.id}-${a.trade_name}`,
        areaName: a.name,
        tradeName: a.trade_name,
        status: 'blocked',
      })),
  ];

  return (
    <SafeAreaView style={styles.safe}>
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

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>&#9989;</Text>
          <Text style={styles.emptyTitle}>{t('legal.noIssues')}</Text>
          <Text style={styles.emptySubtitle}>{t('legal.allClear')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
              </View>
              <Text style={styles.cardArea}>{item.areaName}</Text>
              <Text style={styles.cardTrade}>{item.tradeName}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
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
