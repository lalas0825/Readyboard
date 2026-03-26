import { fetchCorrectiveActions } from '@/features/ready-board/services/fetchCorrectiveActions';
import { CAKanban } from '@/features/ready-board/components/CAKanban';

export default async function CorrectiveActionsPage() {
  const data = await fetchCorrectiveActions();

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Corrective Actions</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Track and resolve corrective actions. Resolving a CA automatically closes the linked delay.
        </p>
      </div>
      <CAKanban data={data} />
    </div>
  );
}
