/**
 * Tab Navigator — 4 tabs for foreman mobile app.
 *
 * My Areas | Report | Legal | Profile
 *
 * Carlos Standard:
 * - Report tab is visually prominent (amber accent)
 * - Min 56px tap targets
 * - Dark theme consistent with web (zinc-950)
 */

import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

// ─── Tab Icons (inline SVG via RN Views) ────────────

function IconAreas({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.iconBox, focused && styles.iconFocused]}>
      <View style={[styles.iconGrid, { borderColor: focused ? '#f59e0b' : '#71717a' }]}>
        <View style={[styles.gridDot, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
        <View style={[styles.gridDot, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
        <View style={[styles.gridDot, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
        <View style={[styles.gridDot, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
      </View>
    </View>
  );
}

function IconToday({ focused }: { focused: boolean }) {
  const color = focused ? '#f59e0b' : '#71717a';
  return (
    <View style={styles.iconBox}>
      {/* Calendar icon */}
      <View style={[styles.calendarOuter, { borderColor: color }]}>
        <View style={[styles.calendarHeader, { backgroundColor: color }]} />
        <View style={styles.calendarGrid}>
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
          <View style={[styles.calendarDot, { backgroundColor: focused ? color : 'transparent', borderWidth: focused ? 0 : 1, borderColor: color }]} />
        </View>
      </View>
    </View>
  );
}

function IconLegal({ focused }: { focused: boolean }) {
  return (
    <View style={styles.iconBox}>
      <View style={[styles.legalIcon, { borderColor: focused ? '#f59e0b' : '#71717a' }]}>
        <View style={[styles.legalLine, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
        <View style={[styles.legalLine, { backgroundColor: focused ? '#f59e0b' : '#71717a', width: 12 }]} />
      </View>
    </View>
  );
}

function IconProfile({ focused }: { focused: boolean }) {
  return (
    <View style={styles.iconBox}>
      <View style={[styles.profileHead, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
      <View style={[styles.profileBody, { backgroundColor: focused ? '#f59e0b' : '#71717a' }]} />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#f59e0b',
        tabBarInactiveTintColor: '#71717a',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.myAreas'),
          tabBarIcon: ({ focused }) => <IconAreas focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <IconToday focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="legal"
        options={{
          title: t('tabs.legal'),
          tabBarIcon: ({ focused }) => <IconLegal focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <IconProfile focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  iconFocused: {},
  // Areas grid icon
  iconGrid: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  // Calendar (Today) icon
  calendarOuter: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  calendarHeader: {
    height: 5,
    width: '100%',
  },
  calendarGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
    gap: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 1,
  },
  // Legal icon
  legalIcon: {
    width: 16,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 2,
    padding: 3,
    gap: 3,
  },
  legalLine: {
    height: 1.5,
    width: 8,
    borderRadius: 1,
  },
  // Profile icon
  profileHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 2,
  },
  profileBody: {
    width: 18,
    height: 8,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
});
