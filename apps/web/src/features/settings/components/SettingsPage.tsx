'use client';

import { useState } from 'react';
import { TradeSequenceConfig } from './TradeSequenceConfig';
import { LaborRatesConfig } from './LaborRatesConfig';
import { GeneralSection } from './GeneralSection';
import { AuditLogSection } from './AuditLogSection';
import { LegalSection } from './LegalSection';
import { UpgradePrompt } from '@/features/billing/components/UpgradePrompt';
import type { ProjectSettings } from '../services/fetchProjectSettings';
import type { PlanId } from '@/lib/stripe';

// ─── Types ──────────────────────────────────────────

type Tab = 'general' | 'trades' | 'legal' | 'integrations' | 'roles' | 'audit';

type Props = {
  projectSettings: ProjectSettings;
  planId: PlanId;
};

const TABS: { key: Tab; label: string; icon: React.ReactNode; proOnly?: boolean }[] = [
  { key: 'general', label: 'General', icon: <IconCog /> },
  { key: 'trades', label: 'Trades & Costs', icon: <IconWrench /> },
  { key: 'legal', label: 'Legal', icon: <IconScale /> },
  { key: 'integrations', label: 'Integrations', icon: <IconPlug />, proOnly: true },
  { key: 'roles', label: 'Team Roles', icon: <IconShield /> },
  { key: 'audit', label: 'Audit Logs', icon: <IconClipboard />, proOnly: true },
];

// ─── Component ──────────────────────────────────────

export function SettingsPage({ projectSettings, planId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const isStarter = planId === 'starter';

  const currentTab = TABS.find((t) => t.key === activeTab);
  const isLocked = currentTab?.proOnly && isStarter;

  return (
    <div className="flex gap-6">
      {/* ─── Vertical Tab Nav ─────────────────── */}
      <nav className="w-48 shrink-0">
        <ul className="space-y-0.5">
          {TABS.map((tab) => (
            <li key={tab.key}>
              <button
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors ${
                  activeTab === tab.key
                    ? 'bg-zinc-800 font-medium text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <span className={activeTab === tab.key ? 'text-amber-400' : 'text-zinc-500'}>
                  {tab.icon}
                </span>
                <span className="flex-1 text-left">{tab.label}</span>
                {tab.proOnly && isStarter && (
                  <span className="text-[9px] text-amber-500">PRO</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ─── Content ──────────────────────────── */}
      <div className="flex-1 min-w-0">
        {isLocked ? (
          <UpgradePrompt
            projectId={projectSettings.projectId}
            feature={currentTab?.label ?? 'Feature'}
            description={`Access ${currentTab?.label} with a Pro plan.`}
          />
        ) : (
          <>
            {activeTab === 'general' && (
              <GeneralSection settings={projectSettings} />
            )}
            {activeTab === 'trades' && (
              <div className="space-y-8">
                <TradeSequenceConfig projectId={projectSettings.projectId} />
                <LaborRatesConfig projectId={projectSettings.projectId} />
              </div>
            )}
            {activeTab === 'legal' && (
              <LegalSection settings={projectSettings} />
            )}
            {activeTab === 'integrations' && (
              <IntegrationsSection />
            )}
            {activeTab === 'roles' && (
              <RolesSection />
            )}
            {activeTab === 'audit' && (
              <AuditLogSection projectId={projectSettings.projectId} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Integrations (placeholder) ─────────────────────

function IntegrationsSection() {
  return (
    <div className="space-y-4">
      <SectionHeader title="Integrations" description="Configure webhooks and external service connections." />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
        <div>
          <label className="text-[10px] font-medium text-zinc-400">Webhook URL (n8n / Make / Zapier)</label>
          <input
            type="url"
            placeholder="https://hooks.example.com/readyboard"
            disabled
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-500 placeholder-zinc-600"
          />
          <p className="mt-1 text-[10px] text-zinc-600">
            Receives events: corrective_action.created, delay.escalated, nod.sent
          </p>
        </div>
        <div className="rounded bg-zinc-800/50 p-3">
          <p className="text-[10px] text-zinc-500">
            API key management and additional integrations coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Roles (read-only reference) ────────────────────

function RolesSection() {
  const roles = [
    { role: 'GC Admin', access: 'Everything + org settings, billing, team management', color: 'text-emerald-400' },
    { role: 'GC PM', access: 'Dashboard, Ready Board, verify, CAs, forecast', color: 'text-blue-400' },
    { role: 'GC Super', access: 'Verify tasks, create CAs, view all trades', color: 'text-cyan-400' },
    { role: 'Sub PM', access: 'Sub areas, legal docs, delay costs, manage foremen', color: 'text-amber-400' },
    { role: 'Superintendent', access: 'Review NODs, send legal docs, manage foremen', color: 'text-orange-400' },
    { role: 'Foreman', access: 'Report status, view assigned areas, submit photos', color: 'text-zinc-400' },
    { role: 'Owner', access: 'Executive summary, projections', color: 'text-purple-400' },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title="Team Roles" description="Role-based access control reference. Roles are assigned during invite." />
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="px-4 py-3 font-medium text-zinc-400">Role</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {roles.map((r) => (
              <tr key={r.role}>
                <td className={`px-4 py-3 font-medium ${r.color}`}>{r.role}</td>
                <td className="px-4 py-3 text-zinc-400">{r.access}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
      <p className="mt-0.5 text-[10px] text-zinc-500">{description}</p>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────

function IconCog() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconWrench() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H21M3 3v18" />
    </svg>
  );
}
function IconScale() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  );
}
function IconPlug() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}
