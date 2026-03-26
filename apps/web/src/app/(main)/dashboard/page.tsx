import { fetchDashboardData } from '@/features/dashboard';
import { fetchGridData } from '@/features/ready-board';
import { GCDashboard } from '@/features/dashboard/components/GCDashboard';

export default async function OverviewPage() {
  const [gridData, dashboardData] = await Promise.all([
    fetchGridData(),
    fetchDashboardData(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <GCDashboard data={dashboardData} projectId={gridData.projectId} />
    </div>
  );
}
