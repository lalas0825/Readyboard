import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { OnboardingStepper } from '@/features/onboarding/components/OnboardingStepper';

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  // If already onboarded, go to dashboard
  const supabase = createServiceClient();
  const { data: user } = await supabase
    .from('users')
    .select('onboarding_complete')
    .eq('id', session.user.id)
    .single();

  if (user?.onboarding_complete) {
    redirect('/dashboard');
  }

  return <OnboardingStepper />;
}
