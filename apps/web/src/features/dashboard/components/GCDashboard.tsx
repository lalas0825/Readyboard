'use client';

import { useState } from 'react';
import { EfficiencyDashboard } from '@/features/ready-board';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { MetricsSection } from './MetricsSection';
import { AlertsSection } from './AlertsSection';
import { NodDraftsSection } from './NodDraftsSection';
import { ForecastSection } from './ForecastSection';
import { CreateAreaModal } from './CreateAreaModal';
import type { DashboardData } from '../types';

type GCDashboardProps = {
  data: DashboardData;
  projectId: string;
};

/**
 * Compositor: assembles all dashboard sections.
 * Each section wrapped in SectionErrorBoundary — if one crashes, the others survive.
 */
export function GCDashboard({ data, projectId }: GCDashboardProps) {
  const [showCreateArea, setShowCreateArea] = useState(false);

  return (
    <div className="space-y-6">
      <SectionErrorBoundary fallbackLabel="Metrics">
        <MetricsSection
          metrics={data.metrics}
          financial={data.financial}
          onAddArea={() => setShowCreateArea(true)}
        />
      </SectionErrorBoundary>

      {/* Empty state CTA — guides user to create first area */}
      {data.metrics.totalAreas === 0 && (
        <div className="rounded-lg border border-dashed border-amber-800/50 bg-amber-950/10 p-8 text-center">
          <p className="text-sm text-zinc-300">Your project has no areas yet.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Create your first area to start tracking trades on the Ready Board.
          </p>
          <button
            onClick={() => setShowCreateArea(true)}
            className="mt-4 rounded-md border border-amber-700 bg-amber-950/50 px-6 py-2.5 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-900/50"
          >
            Initialize Project
          </button>
        </div>
      )}

      <SectionErrorBoundary fallbackLabel="NOD Drafts">
        <NodDraftsSection projectId={projectId} />
      </SectionErrorBoundary>

      <SectionErrorBoundary fallbackLabel="Alerts">
        <AlertsSection
          alerts={data.alerts}
          projectId={projectId}
          scheduleRisks={data.scheduleComparison.filter((r) => (r.deltaDays ?? 0) > 3)}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary fallbackLabel="Forecast">
        <ForecastSection forecast={data.forecast} scheduleComparison={data.scheduleComparison} />
      </SectionErrorBoundary>

      <SectionErrorBoundary fallbackLabel="Efficiency">
        <EfficiencyDashboard />
      </SectionErrorBoundary>

      <CreateAreaModal
        projectId={projectId}
        open={showCreateArea}
        onClose={() => setShowCreateArea(false)}
      />
    </div>
  );
}
