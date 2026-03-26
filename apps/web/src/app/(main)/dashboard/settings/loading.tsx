import { PageSkeleton } from '@/features/dashboard/components/DashboardSkeleton';

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <PageSkeleton />
    </div>
  );
}
