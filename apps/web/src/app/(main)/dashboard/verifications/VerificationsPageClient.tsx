'use client';

import { GCVerificationQueue } from '@/features/checklist';

export function VerificationsPageClient({ projectId }: { projectId: string }) {
  return <GCVerificationQueue projectId={projectId} onCountChange={() => {}} />;
}
