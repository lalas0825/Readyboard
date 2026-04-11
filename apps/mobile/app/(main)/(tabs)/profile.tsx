/**
 * Profile Tab — User info, notification settings, logout.
 *
 * Carlos Standard: clean layout, big logout button, no confusion.
 * Logout clears: auth session, push token, PowerSync connection.
 */

import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, Alert, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useAuth } from '../../../src/providers/AuthProvider';
import { clearPushToken, isPushEnabled } from '../../../src/services/pushNotifications';
import { useAreas } from '@readyboard/shared';

const ROLE_LABELS: Record<string, string> = {
  foreman: 'Foreman',
  sub_pm: 'Sub PM',
  superintendent: 'Superintendent',
  gc_pm: 'GC PM',
  gc_admin: 'GC Admin',
  gc_super: 'GC Super',
  owner: 'Owner',
};

export default function ProfileTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const { areas } = useAreas(session?.user.id);

  const user = session?.user;
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';

  // Derive assigned units from areas
  const assignedUnits = useMemo(() => {
    const unitMap = new Map<string, number>();
    for (const area of areas) {
      const key = area.unit_name ?? 'Common';
      unitMap.set(key, (unitMap.get(key) ?? 0) + 1);
    }
    return Array.from(unitMap.entries()).map(([name, count]) => ({
      name,
      areaCount: count,
    }));
  }, [areas]);

  async function handleLogout() {
    Alert.alert(
      t('auth.logoutConfirmTitle'),
      t('auth.logoutConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            // Clear push token before signing out
            if (user?.id) {
              await clearPushToken(user.id);
            }

            // Sign out (clears Supabase session, PowerSync disconnects)
            await signOut();
            setLoggingOut(false);
          },
        },
      ],
    );
  }

  async function handleTogglePush(value: boolean) {
    setPushEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // In production: save preference to DB
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.profile')}</Text>
      </View>

      {/* User info card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.user_metadata?.name?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.user_metadata?.name ?? user?.phone ?? 'User'}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {ROLE_LABELS[user?.user_metadata?.role ?? ''] ?? 'Member'}
            </Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.details')}</Text>
        <DetailRow label={t('profile.phone')} value={user?.phone ?? '--'} />
        <DetailRow label={t('profile.email')} value={user?.email ?? '--'} />
        <DetailRow label={t('profile.userId')} value={user?.id?.slice(0, 8) ?? '--'} mono />
      </View>

      {/* Assigned units */}
      {assignedUnits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ASSIGNED UNITS</Text>
          {assignedUnits.map((unit) => (
            <View key={unit.name} style={styles.unitRow}>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>
                  {unit.name === 'Common' ? 'COM' : unit.name}
                </Text>
              </View>
              <Text style={styles.unitName}>
                {unit.name === 'Common' ? 'Common Areas' : `Unit ${unit.name}`}
              </Text>
              <Text style={styles.unitCount}>
                {unit.areaCount} {unit.areaCount === 1 ? 'area' : 'areas'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Notification settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.notifications')}</Text>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>{t('profile.pushAlerts')}</Text>
            <Text style={styles.settingDesc}>{t('profile.pushAlertsDesc')}</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={handleTogglePush}
            trackColor={{ false: '#27272a', true: '#f59e0b40' }}
            thumbColor={pushEnabled ? '#f59e0b' : '#71717a'}
          />
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <DetailRow label={t('profile.appVersion')} value={`v${appVersion}`} />
      </View>

      {/* Report Issue */}
      <View style={styles.section}>
        <Pressable
          style={styles.reportButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(main)/report-issue');
          }}
        >
          <Text style={styles.reportIcon}>🐛</Text>
          <View style={styles.reportContent}>
            <Text style={styles.reportLabel}>Report Issue</Text>
            <Text style={styles.reportDesc}>Bug reports or feedback</Text>
          </View>
          <Text style={styles.reportArrow}>›</Text>
        </Pressable>
      </View>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          <Text style={styles.logoutText}>
            {loggingOut ? t('common.loading') : t('auth.logout')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]}>{value}</Text>
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
  // User card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  roleBadge: {
    backgroundColor: '#f59e0b20',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#f59e0b40',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  // Sections
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  detailValue: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '500',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#64748b',
  },
  // Assigned units
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  unitBadge: {
    width: 40,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f59e0b20',
    borderWidth: 1,
    borderColor: '#f59e0b40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.3,
  },
  unitName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  unitCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  // Notification setting
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
  },
  settingLabel: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  // Report Issue
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportIcon: {
    fontSize: 22,
  },
  reportContent: {
    flex: 1,
  },
  reportLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  reportDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  reportArrow: {
    fontSize: 20,
    color: '#475569',
  },
  // Logout
  logoutSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    backgroundColor: '#450a0a',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
  },
});
