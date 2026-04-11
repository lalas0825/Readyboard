import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { Sidebar } from '@/features/dashboard/components/Sidebar';
import { fetchProjectContext } from '@/features/dashboard/services/fetchProjectContext';
import { TrialBanner } from '@/features/billing/components/TrialBanner';
import { NotificationBell } from '@/features/dashboard/components/NotificationBell';
import { LiveIndicator } from '@/features/dashboard/components/LiveIndicator';
import { TopBarActionsProvider, TopBarActionsSlot } from '@/components/TopBarActionsProvider';
import { FeedbackButton } from '@/features/feedback/components/FeedbackButton';

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

  // Fetch trial info for banner — parallel with nothing (depends on projectCtx.currentProjectId)
  // but isolated so it never blocks rendering if it fails.
  // Fetch subscription once — used for both the trial banner AND past_due redirect.
  // The past_due check was previously in middleware (extra DB query per navigation).
  // Now it runs here where we already need this data for the trial banner.
  let trialEndsAt: string | null = null;
  let subStatus = 'active';
  if (projectCtx.currentProjectId && !session.isDevBypass) {
    try {
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
        // Redirect past-due accounts to payment page (previously in middleware)
        if (sub.status === 'past_due') {
          const { redirect } = await import('next/navigation');
          redirect('/billing/payment-required');
        }
      }
    } catch {
      // Non-fatal — banner just won't show, past_due check skipped
    }
  }

  return (
    <TopBarActionsProvider>
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
      <main className="flex flex-1 flex-col overflow-auto lg:ml-0">
        {/* Top bar — mobile: hamburger spacer | desktop: right-side controls */}
        <div className="flex h-12 shrink-0 items-center justify-between px-4 lg:justify-end">
          {/* Mobile hamburger spacer (actual hamburger is in Sidebar) */}
          <div className="lg:hidden" />
          {/* Desktop: page actions + live indicator + notification bell */}
          <div className="hidden items-center gap-2 lg:flex">
            <TopBarActionsSlot />
            <div className="mx-1 h-4 w-px bg-zinc-700" />
            <LiveIndicator />
            <NotificationBell />
          </div>
        </div>

        {/* Trial banner */}
        <div className="px-6">
          <TrialBanner trialEndsAt={trialEndsAt} status={subStatus} />
        </div>

        {children}

        {/* Floating feedback button — visible on all dashboard pages */}
        <FeedbackButton projectId={projectCtx.currentProjectId ?? undefined} />
      </main>
    </div>
    </TopBarActionsProvider>
  )
}
