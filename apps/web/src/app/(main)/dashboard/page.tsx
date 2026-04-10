import { fetchDashboardData } from '@/features/dashboard';
import { GCDashboard } from '@/features/dashboard/components/GCDashboard';

export default async function OverviewPage() {
  const dashboardData = await fetchDashboardData();

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <GCDashboard data={dashboardData} projectId={dashboardData.metrics.projectId} />
    </div>
  );
}
