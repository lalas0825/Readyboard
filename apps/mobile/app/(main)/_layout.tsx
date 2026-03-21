/**
 * (main) Layout — Auth-gated route group.
 *
 * All routes inside (main)/ require an active session.
 * Redirects to /login if no session after auth loading.
 */

import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';

export default function MainLayout() {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/login');
    }
  }, [isLoading, session, router]);

  // Show nothing while auth is loading or no session
  if (isLoading || !session) return null;

  return <Slot />;
}
