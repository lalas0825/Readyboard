'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { fetchUnreadNotificationCount } from '../services/fetchNotifications';
import { fetchVerificationCount } from '@/features/checklist/services/fetchVerificationCount';

// ─── Types ───────────────────────────────────────────

type SidebarProps = {
  user: {
    name: string;
    role: string;
    isDevBypass: boolean;
  };
  projects: { id: string; name: string }[];
  currentProjectId: string;
};

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: 'legal' | 'verifications' | 'delays';
};

// ─── Icons (inline SVG, no deps) ─────────────────────

const icons = {
  overview: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  readyboard: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
    </svg>
  ),
  verifications: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
    </svg>
  ),
  delays: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  legal: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  ),
  forecast: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  correctiveActions: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H21M3 3v18" />
    </svg>
  ),
  schedule: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  team: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  settings: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  billing: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  hamburger: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  close: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronDown: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  ),
};

// ─── Nav Config ──────────────────────────────────────

function buildNavItems(): NavItem[] {
  return [
    { key: 'overview', label: 'Overview', href: '/dashboard', icon: icons.overview },
    { key: 'readyboard', label: 'Ready Board', href: '/dashboard/readyboard', icon: icons.readyboard },
    { key: 'verifications', label: 'Verifications', href: '/dashboard/verifications', icon: icons.verifications, badge: 'verifications' },
    { key: 'delays', label: 'Delays & Costs', href: '/dashboard/delays', icon: icons.delays, badge: 'delays' },
    { key: 'legal', label: 'Legal Docs', href: '/dashboard/legal', icon: icons.legal, badge: 'legal' },
    { key: 'forecast', label: 'Forecast', href: '/dashboard/forecast', icon: icons.forecast },
    { key: 'corrective-actions', label: 'Corrective Actions', href: '/dashboard/corrective-actions', icon: icons.correctiveActions },
    { key: 'schedule', label: 'Schedule', href: '/dashboard/schedule', icon: icons.schedule },
    { key: 'team', label: 'Team', href: '/dashboard/team', icon: icons.team },
    { key: 'settings', label: 'Settings', href: '/dashboard/settings', icon: icons.settings },
  ];
}

// ─── Badge Component ─────────────────────────────────

function NavBadge({ count, color }: { count: number; color: 'red' | 'amber' }) {
  if (count === 0) return null;
  const bg = color === 'red' ? 'bg-red-500' : 'bg-amber-500';
  return (
    <span className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full ${bg} px-1 text-[9px] font-bold text-white`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ─── Sidebar Component ───────────────────────────────

export function Sidebar({ user, projects, currentProjectId }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Badge counts
  const [legalCount, setLegalCount] = useState(0);
  const [verifyCount, setVerifyCount] = useState(0);

  useEffect(() => {
    fetchUnreadNotificationCount().then(setLegalCount).catch(() => {});
    fetchVerificationCount().then(setVerifyCount).catch(() => {});
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = buildNavItems();
  const currentProject = projects.find((p) => p.id === currentProjectId);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/dashboard') return pathname === '/dashboard';
      return pathname.startsWith(href);
    },
    [pathname],
  );

  const getBadgeCount = (badge?: string) => {
    if (badge === 'legal') return legalCount;
    if (badge === 'verifications') return verifyCount;
    return 0;
  };

  const getBadgeColor = (badge?: string): 'red' | 'amber' => {
    if (badge === 'legal') return 'red';
    return 'amber';
  };

  // ─── Shared sidebar content ──────────────────────

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/readyboard-icon-animated.svg" alt="" className="h-6 w-6" />
        <span className="text-sm font-semibold text-zinc-100">ReadyBoard</span>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="border-b border-zinc-800 px-3 py-3">
          <button
            onClick={() => setProjectSelectorOpen(!projectSelectorOpen)}
            className="flex w-full items-center justify-between rounded-md bg-zinc-800/50 px-3 py-2 text-left transition-colors hover:bg-zinc-800"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-300">
                {currentProject?.name ?? 'Select Project'}
              </p>
              <p className="text-[10px] text-zinc-600">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span className={`ml-2 text-zinc-500 transition-transform ${projectSelectorOpen ? 'rotate-180' : ''}`}>
              {icons.chevronDown}
            </span>
          </button>
          {projectSelectorOpen && projects.length > 1 && (
            <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-850 py-1">
              {projects.map((p) => (
                <a
                  key={p.id}
                  href={`/dashboard?project=${p.id}`}
                  className={`block truncate px-3 py-1.5 text-xs transition-colors ${
                    p.id === currentProjectId
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  {p.name}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-zinc-800 font-medium text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  <span className={active ? 'text-amber-400' : 'text-zinc-500'}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <NavBadge
                      count={getBadgeCount(item.badge)}
                      color={getBadgeColor(item.badge)}
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Billing — separated */}
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <Link
            href="/dashboard/billing"
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === '/dashboard/billing'
                ? 'bg-zinc-800 font-medium text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
            }`}
          >
            <span className={pathname === '/dashboard/billing' ? 'text-amber-400' : 'text-zinc-500'}>
              {icons.billing}
            </span>
            <span className="flex-1">Billing</span>
          </Link>
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-zinc-800 px-3 py-3 space-y-2">
        <div className="px-1 space-y-1">
          <p className="truncate text-xs font-medium text-zinc-300">{user.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">
            {user.role.replace('_', ' ')}
            {user.isDevBypass && ' (dev)'}
          </p>
        </div>
        <LogoutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-md bg-zinc-900 p-2 text-zinc-400 shadow-lg transition-colors hover:bg-zinc-800 hover:text-zinc-200 lg:hidden"
        aria-label="Open navigation"
      >
        {icons.hamburger}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-zinc-900 transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 hover:text-zinc-300"
          aria-label="Close navigation"
        >
          {icons.close}
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-col border-r border-zinc-800 bg-zinc-900 lg:flex">
        {sidebarContent}
      </aside>
    </>
  );
}
