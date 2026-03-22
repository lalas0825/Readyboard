import { fetchGridData } from '@/features/ready-board';
import { DashboardTabs, fetchDashboardData } from '@/features/dashboard';

export default async function DashboardPage() {
  const [gridData, dashboardData] = await Promise.all([
    fetchGridData(),
    fetchDashboardData(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <DashboardTabs gridData={gridData} dashboardData={dashboardData} />
    </div>
  );
}
