import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';
import { Sidebar } from '@/features/dashboard/components/Sidebar';
import { fetchProjectContext } from '@/features/dashboard/services/fetchProjectContext';

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
        {/* Mobile top spacer for hamburger button */}
        <div className="h-14 lg:hidden" />
        {children}
      </main>
    </div>
  )
}
