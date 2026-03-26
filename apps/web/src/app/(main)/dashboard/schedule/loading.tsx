import { PageSkeleton } from '@/features/dashboard/components/DashboardSkeleton';

export default function ScheduleLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <PageSkeleton />
    </div>
  );
}
