import { fetchTeamMembers } from '@/features/invites/services/fetchTeamMembers';
import { TeamManagementView } from '@/features/invites/components/TeamManagementView';
import { getSession } from '@/lib/auth/getSession';

export default async function TeamPage() {
  const [data, session] = await Promise.all([
    fetchTeamMembers(),
    getSession(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-100">Team</h1>
        <p className="mt-1 text-xs text-zinc-500">
          Manage team members and invite new users to the project.
        </p>
      </div>
      <TeamManagementView
        data={data}
        userRole={session?.user.role ?? 'gc_pm'}
      />
    </div>
  );
}
