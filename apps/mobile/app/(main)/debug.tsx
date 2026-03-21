/**
 * Debug Route — Dev-only observability screen.
 *
 * Renders DebugNav panel in __DEV__, returns null in production.
 * Accessible via triple-tap on the title in Foreman Home.
 */

import { View } from 'react-native';
import DebugNav from '../../src/components/DebugNav';

export default function DebugScreen() {
  if (!__DEV__) return <View />;
  return <DebugNav />;
}
