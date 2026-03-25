import { getSession } from '@/lib/auth/getSession';
import { LogoutButton } from '@/features/auth/components/LogoutButton';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession();

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/readyboard-icon-animated.svg" alt="" className="h-6 w-6" />
          <span className="text-sm font-semibold text-zinc-100">ReadyBoard</span>
        </div>
        <nav className="flex-1 p-3">
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            <span className="text-base">&#9632;</span>
            Dashboard
          </a>
        </nav>
        <div className="border-t border-zinc-800 px-3 py-3 space-y-2">
          {session ? (
            <>
              <div className="px-1 space-y-1">
                <p className="truncate text-xs font-medium text-zinc-300">
                  {session.user.name}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                  {session.user.role.replace('_', ' ')}
                  {session.isDevBypass && ' (dev)'}
                </p>
              </div>
              <LogoutButton />
            </>
          ) : (
            <p className="px-1 text-xs text-zinc-600">ReadyBoard v0.1</p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
