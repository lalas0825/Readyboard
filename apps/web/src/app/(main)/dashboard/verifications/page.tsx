import { fetchGridData } from '@/features/ready-board';
import { VerificationsPageClient } from './VerificationsPageClient';

export default async function VerificationsPage() {
  const gridData = await fetchGridData();

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <VerificationsPageClient projectId={gridData.projectId} />
    </div>
  );
}
