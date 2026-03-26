'use client';

import { useState, useEffect, useCallback } from 'react';
import { ReadyBoardGrid, type ReadyBoardInitialData } from '@/features/ready-board';
import { GCDashboard } from './GCDashboard';
import { LegalDocsTab } from './LegalDocsTab';
import { fetchUnreadNotificationCount } from '../services/fetchNotifications';
import { GCVerificationQueue } from '@/features/checklist';
import { fetchVerificationCount } from '@/features/checklist/services/fetchVerificationCount';
import { TradeConfig } from '@/features/settings';
import { UpgradePrompt } from '@/features/billing/components/UpgradePrompt';
import { BillingTab } from '@/features/billing/components/BillingTab';
import type { PlanId } from '@/lib/stripe';
import type { DashboardData } from '../types';

type Tab = 'overview' | 'readyboard' | 'verifications' | 'legal' | 'settings' | 'billing';

type PlanData = {
  planId: PlanId;
  status: string;
  currentPeriodEnd: string | null;
};

type DashboardTabsProps = {
  gridData: ReadyBoardInitialData;
  dashboardData: DashboardData;
  planData: PlanData;
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'readyboard', label: 'Ready Board' },
  { key: 'verifications', label: 'Verifications' },
  { key: 'legal', label: 'Legal Docs' },
  { key: 'settings', label: 'Settings' },
  { key: 'billing', label: 'Billing' },
];

/**
 * Client component with local tab state.
 * Data fetched once at server level, passed down — tab switch is instant.
 * Legal tab and Verification queue lazy-load their own data independently.
 */
export function DashboardTabs({ gridData, dashboardData, planData }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [unreadCount, setUnreadCount] = useState(0);
  const [verifyCount, setVerifyCount] = useState(0);

  useEffect(() => {
    fetchUnreadNotificationCount().then(setUnreadCount).catch(() => {/* silent */});
    fetchVerificationCount().then(setVerifyCount).catch(() => {/* silent */});
  }, []);

  const handleVerificationCountChange = useCallback((count: number) => {
    setVerifyCount(count);
  }, []);

  const isStarter = planData.planId === 'starter';

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
            {tab.key === 'verifications' && verifyCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {verifyCount > 9 ? '9+' : verifyCount}
              </span>
            )}
            {tab.key === 'legal' && isStarter && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[9px] font-bold text-white">
                &#128274;
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <GCDashboard data={dashboardData} projectId={gridData.projectId} />}
      {activeTab === 'readyboard' && <ReadyBoardGrid initialData={gridData} />}
      {activeTab === 'verifications' && (
        <GCVerificationQueue
          projectId={gridData.projectId}
          onCountChange={handleVerificationCountChange}
        />
      )}
      {activeTab === 'legal' && (
        isStarter
          ? <UpgradePrompt projectId={gridData.projectId} feature="Legal Documents" description="Generate NODs, REAs, and Evidence Packages with SHA-256 hashing and receipt tracking." />
          : <LegalDocsTab projectId={gridData.projectId} />
      )}
      {activeTab === 'settings' && <TradeConfig projectId={gridData.projectId} />}
      {activeTab === 'billing' && (
        <BillingTab
          projectId={gridData.projectId}
          currentPlan={planData.planId}
          status={planData.status}
          currentPeriodEnd={planData.currentPeriodEnd}
        />
      )}
    </div>
  );
}
