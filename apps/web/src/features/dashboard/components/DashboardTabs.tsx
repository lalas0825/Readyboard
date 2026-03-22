'use client';

import { useState } from 'react';
import { ReadyBoardGrid, type ReadyBoardInitialData } from '@/features/ready-board';
import { GCDashboard } from './GCDashboard';
import { LegalDocsTab } from './LegalDocsTab';
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

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
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
