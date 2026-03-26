import { fetchGridData } from '@/features/ready-board';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { BillingTab } from '@/features/billing/components/BillingTab';

export default async function BillingPage() {
  const gridData = await fetchGridData();
  const plan = await getPlanForProject(gridData.projectId);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <BillingTab
        projectId={gridData.projectId}
        currentPlan={plan.planId}
        status={plan.status}
        currentPeriodEnd={plan.currentPeriodEnd}
      />
    </div>
  );
}
