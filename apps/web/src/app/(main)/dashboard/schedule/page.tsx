import { fetchGridData } from '@/features/ready-board';
import { fetchScheduleItems } from '@/features/forecast/services/fetchSchedule';
import { getPlanForProject } from '@/features/billing/services/getPlanForProject';
import { ScheduleUpload } from '@/features/forecast/components/ScheduleUpload';

export default async function SchedulePage() {
  const gridData = await fetchGridData();
  const [items, plan] = await Promise.all([
    fetchScheduleItems(gridData.projectId),
    getPlanForProject(gridData.projectId),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Schedule</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Import P6/CSV schedules to enable forecast projections and critical path tracking.
        </p>
      </div>
      <ScheduleUpload
        projectId={gridData.projectId}
        planId={plan.planId}
        existingItems={items}
      />
    </div>
  );
}
