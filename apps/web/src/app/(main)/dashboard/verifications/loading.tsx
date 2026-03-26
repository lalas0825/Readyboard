import { TableSkeleton } from '@/features/dashboard/components/DashboardSkeleton';

export default function VerificationsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <TableSkeleton rows={6} />
    </div>
  );
}
