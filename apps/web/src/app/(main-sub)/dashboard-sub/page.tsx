import { fetchSubProjects } from '@/features/invites/services/fetchSubProjects';
import { fetchGridData } from '@/features/ready-board';
import { ReadyBoardGrid } from '@/features/ready-board/components/ReadyBoardGrid';

export default async function SubDashboardPage() {
  const projects = await fetchSubProjects();

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="flex flex-col items-center justify-center py-24">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
            <span className="text-2xl">&#128197;</span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-100">No Projects Yet</h2>
          <p className="mt-2 max-w-xs text-center text-sm text-zinc-500">
            You haven&apos;t been invited to any projects. Ask your General Contractor for an invite link.
          </p>
        </div>
      </div>
    );
  }

  // Load grid data for the first project (V1: sub sees one project)
  const firstProject = projects[0];
  const gridData = await fetchGridData(firstProject.projectId);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-zinc-100">{firstProject.projectName}</h1>
        <p className="text-xs text-zinc-500">Specialty Contractor View</p>
      </div>
      <ReadyBoardGrid initialData={gridData} />
    </div>
  );
}
