import { fetchGridData } from '@/features/ready-board';
import { DashboardTabs, fetchDashboardData } from '@/features/dashboard';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';

export default async function DashboardPage() {
  const [gridData, dashboardData] = await Promise.all([
    fetchGridData(),
    fetchDashboardData(),
  ]);

  // Fetch plan data (depends on gridData.projectId)
  const plan = await getPlanForProject(gridData.projectId);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <DashboardTabs
        gridData={gridData}
        dashboardData={dashboardData}
        planData={{
          planId: plan.planId,
          status: plan.status,
          currentPeriodEnd: plan.currentPeriodEnd,
        }}
      />
    </div>
  );
}
