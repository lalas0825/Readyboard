import { fetchProjectSettings } from '@/features/settings/services/fetchProjectSettings';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { fetchGridData } from '@/features/ready-board';
import { SettingsPage } from '@/features/settings/components/SettingsPage';
import { fetchFeedback, countNewFeedback } from '@/features/feedback/services/fetchFeedback';
import { getSession } from '@/lib/auth/getSession';

export default async function SettingsPageRoute() {
  const [gridData, session] = await Promise.all([fetchGridData(), getSession()]);
  const userRole = session?.user.role ?? '';

  const isGcAdmin = userRole === 'gc_admin';

  const [settings, plan, feedbackResult, newFeedbackCount] = await Promise.all([
    fetchProjectSettings(gridData.projectId),
    getPlanForProject(gridData.projectId),
    isGcAdmin ? fetchFeedback(gridData.projectId) : Promise.resolve({ reports: [], summary: { new: 0, reviewing: 0, in_progress: 0, resolved: 0 } }),
    isGcAdmin ? countNewFeedback() : Promise.resolve(0),
  ]);

  if (!settings) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <p className="text-sm text-zinc-400">No project found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Project configuration, trade setup, legal thresholds, and audit history.
        </p>
      </div>
      <SettingsPage
        projectSettings={settings}
        planId={plan.planId}
        userRole={userRole}
        feedbackReports={feedbackResult.reports}
        feedbackSummary={feedbackResult.summary}
        newFeedbackCount={newFeedbackCount}
      />
    </div>
  );
}
