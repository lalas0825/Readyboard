'use client';

import { useState, useEffect } from 'react';
import { ReadyBoardGrid, type ReadyBoardInitialData } from '@/features/ready-board';
import { GCDashboard } from './GCDashboard';
import { LegalDocsTab } from './LegalDocsTab';
import { fetchUnreadNotificationCount } from '../services/fetchNotifications';
import type { DashboardData } from '../types';

type Tab = 'overview' | 'readyboard' | 'legal';

type DashboardTabsProps = {
  gridData: ReadyBoardInitialData;
  dashboardData: DashboardData;
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'readyboard', label: 'Ready Board' },
  { key: 'legal', label: 'Legal Docs' },
];

/**
 * Client component with local tab state.
 * Data fetched once at server level, passed down — tab switch is instant.
 * Legal tab lazy-loads its own data independently.
 */
export function DashboardTabs({ gridData, dashboardData }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadNotificationCount().then(setUnreadCount).catch(() => {/* silent */});
  }, []);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {tab.key === 'legal' && unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <GCDashboard data={dashboardData} projectId={gridData.projectId} />}
      {activeTab === 'readyboard' && <ReadyBoardGrid initialData={gridData} />}
      {activeTab === 'legal' && <LegalDocsTab projectId={gridData.projectId} />}
    </div>
  );
}
