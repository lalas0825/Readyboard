import { GridSkeleton } from '@/features/dashboard/components/DashboardSkeleton';

export default function ReadyBoardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <GridSkeleton />
    </div>
  );
}
