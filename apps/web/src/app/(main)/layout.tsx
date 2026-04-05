import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { Sidebar } from '@/features/dashboard/components/Sidebar';
import { fetchProjectContext } from '@/features/dashboard/services/fetchProjectContext';
import { TrialBanner } from '@/features/billing/components/TrialBanner';
import { NotificationBell } from '@/features/dashboard/components/NotificationBell';
import { LiveIndicator } from '@/features/dashboard/components/LiveIndicator';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession();

  // Defense-in-depth: block non-GC roles at layout level (mirrors sub layout guard)
  if (!session) {
    redirect('/login');
  }
  const gcRoles = ['gc_super', 'gc_pm', 'gc_admin', 'owner'];
  if (!session.isDevBypass && !gcRoles.includes(session.user.role)) {
    const subRoles = ['sub_pm', 'sub_super'];
    if (subRoles.includes(session.user.role)) {
      redirect('/dashboard-sub');
    }
    redirect('/login');
  }

  // Redirect to onboarding if GC user hasn't completed setup
  if (session && !session.isDevBypass) {
    if (gcRoles.includes(session.user.role)) {
      const supabase = createServiceClient();
      const { data: user } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', session.user.id)
        .single();

      if (user && !user.onboarding_complete) {
        redirect('/onboarding');
      }
    }
  }

  const projectCtx = await fetchProjectContext();

  // Fetch trial info for banner
  let trialEndsAt: string | null = null;
  let subStatus = 'active';
  if (projectCtx.currentProjectId && !session.isDevBypass) {
    const supabase2 = createServiceClient();
    const { data: sub } = await supabase2
      .from('project_subscriptions')
      .select('status, trial_ends_at')
      .eq('project_id', projectCtx.currentProjectId)
      .in('status', ['active', 'past_due', 'trialing'])
      .limit(1)
      .maybeSingle();
    if (sub) {
      trialEndsAt = sub.trial_ends_at;
      subStatus = sub.status;
    }
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <Sidebar
        user={{
          name: session.user.name,
          role: session.user.role,
          isDevBypass: session.isDevBypass,
        }}
        projects={projectCtx.projects}
        currentProjectId={projectCtx.currentProjectId}
      />

      {/* Main content */}
      <main className="flex-1 overflow-auto lg:ml-0">
        {/* Top-right controls — fixed position, always visible */}
        <div className="fixed right-4 top-3 z-40 hidden items-center gap-3 lg:flex">
          <LiveIndicator />
          <NotificationBell />
        </div>
        {/* Mobile top spacer for hamburger button */}
        <div className="h-14 lg:hidden" />
        <div className="px-6 pt-2">
          <TrialBanner trialEndsAt={trialEndsAt} status={subStatus} />
        </div>
        {children}
      </main>
    </div>
  )
}
