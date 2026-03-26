import { ReadyBoardGrid, fetchGridData } from '@/features/ready-board';

export default async function ReadyBoardPage() {
  const gridData = await fetchGridData();

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <ReadyBoardGrid initialData={gridData} />
    </div>
  );
}
