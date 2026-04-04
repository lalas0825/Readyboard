import { validateInviteToken } from '@/features/invites/services/validateInviteToken';
import { JoinProjectForm } from '@/features/invites/components/JoinProjectForm';
import Link from 'next/link';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const result = await validateInviteToken(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-10 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/readyboard-icon-animated.svg" alt="" className="h-8 w-8" />
          <span className="text-xl font-bold text-zinc-100">ReadyBoard</span>
        </div>

        {result.ok ? (
          <>
            <h1 className="mb-6 text-center text-xl font-semibold text-zinc-100">
              Join Project
            </h1>
            <JoinProjectForm invite={result.data} />
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30">
              <span className="text-2xl">&#10060;</span>
            </div>
            <h1 className="mb-2 text-xl font-semibold text-zinc-100">
              Invalid Invite
            </h1>
            <p className="mb-6 text-sm text-zinc-400">{result.error}</p>
            <Link
              href="/login"
              className="inline-block rounded-lg bg-zinc-800 px-6 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
