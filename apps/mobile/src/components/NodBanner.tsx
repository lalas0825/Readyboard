/**
 * NodBanner — Sticky red banner when unsent NOD drafts exist.
 *
 * Shows at the top of the Foreman Home Screen inside a SafeAreaView.
 * Tapping navigates to NOD review (future route, logs for now).
 *
 * Carlos Standard: high contrast red, large text, single tap action.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import type { PendingNod } from '@readyboard/shared';

type Props = {
  nods: PendingNod[];
  onPress?: (nod: PendingNod) => void;
};

export default function NodBanner({ nods, onPress }: Props) {
  if (nods.length === 0) return null;

  const { t } = useTranslation();
  const first = nods[0];

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) {
      onPress(first);
    }
  }

  return (
    <Pressable style={styles.banner} onPress={handlePress}>
      <View style={styles.content}>
        <Text style={styles.icon}>{'\u2696'}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {t('legal.nodDraftReady')}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {first.area_name} — {nods.length > 1
              ? `+${nods.length - 1} ${t('common.more')}`
              : t('legal.tapToReview')}
          </Text>
        </View>
        <Text style={styles.arrow}>{'\u203A'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f5f3ff',
  },
  subtitle: {
    fontSize: 13,
    color: '#c4b5fd',
    marginTop: 2,
  },
  arrow: {
    fontSize: 28,
    color: '#c4b5fd',
    fontWeight: '300',
  },
});
