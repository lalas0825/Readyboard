import { fetchDelayDetails } from '@/features/delays/services/fetchDelayDetails';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { DelaysTable } from '@/features/delays/components/DelaysTable';

export default async function DelaysPage() {
  const data = await fetchDelayDetails();
  const plan = await getPlanForProject(data.projectId);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Delays & Costs</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Financial impact of active and historical delays. Generate NODs for legal documentation.
        </p>
      </div>

      <DelaysTable
        delays={data.delays}
        totals={data.totals}
        laborRate={data.laborRate}
        trades={data.trades}
        projectId={data.projectId}
        planId={plan.planId}
      />
    </div>
  );
}
