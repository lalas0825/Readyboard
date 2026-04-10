import { fetchGridData } from '@/features/ready-board';
import { fetchScheduleItems } from '@/features/forecast/services/fetchSchedule';
import { fetchScheduleBaselines } from '@/features/forecast/services/fetchScheduleBaselines';
import { fetchFloorTradeMatrix } from '@/features/forecast/services/fetchFloorTradeMatrix';
import { fetchGanttData } from '@/features/forecast/services/fetchGanttData';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { SchedulePageClient } from '@/features/forecast/components/SchedulePageClient';

type Props = {
  searchParams: Promise<{ floor?: string; view?: string }>;
};

export default async function SchedulePage({ searchParams }: Props) {
  const params = await searchParams;
  const gridData = await fetchGridData();

  const [items, plan, baselines, matrix, gantt] = await Promise.all([
    fetchScheduleItems(gridData.projectId),
    getPlanForProject(gridData.projectId),
    fetchScheduleBaselines(gridData.projectId),
    fetchFloorTradeMatrix(gridData.projectId),
    fetchGanttData(gridData.projectId),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Schedule</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Enter planned dates per floor × trade, import a P6/CSV schedule, or view the Gantt timeline.
        </p>
      </div>
      <SchedulePageClient
        projectId={gridData.projectId}
        planId={plan.planId}
        existingItems={items}
        baselines={baselines}
        matrix={matrix}
        gantt={gantt}
        initialFloor={params.floor ?? null}
      />
    </div>
  );
}
