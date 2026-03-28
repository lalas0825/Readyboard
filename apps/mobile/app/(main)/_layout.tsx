/**
 * (main) Layout — Auth-gated route group.
 *
 * All routes inside (main)/ require an active session.
 * Redirects to /login if no session after auth loading.
 * Uses declarative Redirect to avoid "navigate before mount" crash.
 */

import { Slot, Redirect } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function MainLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) return null;

  if (!session) return <Redirect href="/login" />;

  return <Slot />;
}
