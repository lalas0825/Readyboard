'use client';

import { LegalDocsTab } from '@/features/dashboard/components/LegalDocsTab';
import { UpgradePrompt } from '@/features/billing/components/UpgradePrompt';
import type { PlanId } from '@/lib/stripe';

type Props = {
  projectId: string;
  planId: PlanId;
};

export function LegalPageClient({ projectId, planId }: Props) {
  if (planId === 'starter') {
    return (
      <UpgradePrompt
        projectId={projectId}
        feature="Legal Documents"
        description="Generate NODs, REAs, and Evidence Packages with SHA-256 hashing and receipt tracking."
      />
    );
  }

  return <LegalDocsTab projectId={projectId} />;
}
