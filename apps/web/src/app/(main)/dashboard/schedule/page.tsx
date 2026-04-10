import { fetchGridData } from '@/features/ready-board';
import { fetchScheduleItems } from '@/features/forecast/services/fetchSchedule';
import { fetchScheduleBaselines } from '@/features/forecast/services/fetchScheduleBaselines';
import { fetchFloorTradeMatrix } from '@/features/forecast/services/fetchFloorTradeMatrix';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { SchedulePageClient } from '@/features/forecast/components/SchedulePageClient';

export default async function SchedulePage() {
  const gridData = await fetchGridData();

  const [items, plan, baselines, matrix] = await Promise.all([
    fetchScheduleItems(gridData.projectId),
    getPlanForProject(gridData.projectId),
    fetchScheduleBaselines(gridData.projectId),
    fetchFloorTradeMatrix(gridData.projectId),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Schedule</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Enter planned dates per floor × trade manually, or import a P6/CSV schedule.
        </p>
      </div>
      <SchedulePageClient
        projectId={gridData.projectId}
        planId={plan.planId}
        existingItems={items}
        baselines={baselines}
        matrix={matrix}
      />
    </div>
  );
}
