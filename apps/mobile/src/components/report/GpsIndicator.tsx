/**
 * GpsIndicator — Visual GPS lock status.
 *
 * Green = locked, amber = acquiring, red = no permission/failed.
 * Carlos Standard: color does the talking, no reading required.
 */

import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { GpsState } from '../../hooks/useFieldEvidence';

type Props = {
  gps: GpsState;
  loading: boolean;
  hasPermission: boolean;
};

export default function GpsIndicator({ gps, loading, hasPermission }: Props) {
  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.containerRed]}>
        <View style={[styles.dot, styles.dotRed]} />
        <Text style={styles.textRed}>GPS Off</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.containerAmber]}>
        <ActivityIndicator size="small" color="#f59e0b" />
        <Text style={styles.textAmber}>GPS...</Text>
      </View>
    );
  }

  if (gps) {
    return (
      <View style={[styles.container, styles.containerGreen]}>
        <View style={[styles.dot, styles.dotGreen]} />
        <Text style={styles.textGreen}>GPS Lock</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.containerAmber]}>
      <View style={[styles.dot, styles.dotAmber]} />
      <Text style={styles.textAmber}>No GPS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  containerGreen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  containerAmber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  containerRed: { backgroundColor: 'rgba(239,68,68,0.15)' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: { backgroundColor: '#22c55e' },
  dotAmber: { backgroundColor: '#f59e0b' },
  dotRed: { backgroundColor: '#ef4444' },
  textGreen: { fontSize: 11, fontWeight: '600', color: '#22c55e' },
  textAmber: { fontSize: 11, fontWeight: '600', color: '#f59e0b' },
  textRed: { fontSize: 11, fontWeight: '600', color: '#ef4444' },
});
