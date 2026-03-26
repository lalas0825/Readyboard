import { fetchProjectSettings } from '@/features/settings/services/fetchProjectSettings';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { fetchGridData } from '@/features/ready-board';
import { SettingsPage } from '@/features/settings/components/SettingsPage';

export default async function SettingsPageRoute() {
  const gridData = await fetchGridData();
  const [settings, plan] = await Promise.all([
    fetchProjectSettings(gridData.projectId),
    getPlanForProject(gridData.projectId),
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
      <SettingsPage projectSettings={settings} planId={plan.planId} />
    </div>
  );
}
