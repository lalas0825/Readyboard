import { fetchGridData } from '@/features/ready-board';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { LegalPageClient } from './LegalPageClient';

export default async function LegalPage() {
  const gridData = await fetchGridData();
  const plan = await getPlanForProject(gridData.projectId);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <LegalPageClient
        projectId={gridData.projectId}
        planId={plan.planId}
      />
    </div>
  );
}
