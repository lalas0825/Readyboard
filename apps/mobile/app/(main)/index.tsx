/**
 * Foreman Home Screen — Areas assigned to the current user.
 *
 * Shows color-coded area cards grouped by status:
 * READY (green) → ALMOST (yellow) → WORKING (blue) → HELD (purple) → BLOCKED (red)
 *
 * NOD Banner: sticky purple banner when unsent NOD drafts exist.
 * Triple-tap on title → navigates to /debug (dev-only).
 * Offline indicator: subtle dot in header when PowerSync disconnected.
 *
 * Carlos Standard: 56px+ buttons, 20px+ text, high contrast, zero menus.
 */

import { useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAreas, useReportStore, type AssignedArea } from '@readyboard/shared';
import { useAuth } from '../../src/providers/AuthProvider';
import AreaCard from '../../src/components/AreaCard';
import NodBanner from '../../src/components/NodBanner';

export default function ForemanHome() {
  const { session, signOut } = useAuth();
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
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/report');
  }

  async function handleSignOut() {
    await signOut();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  const renderItem = useCallback(
    ({ item }: { item: AssignedArea }) => (
      <AreaCard area={item} onReport={handleReport} />
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
    <SafeAreaView style={styles.safe}>
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
        <Pressable style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutText}>{t('auth.logout')}</Text>
        </Pressable>
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* Area list */}
      <FlatList
        data={areas}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  logoutButton: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
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
