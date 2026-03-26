'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { PLAN_CONFIG, type PlanId, type ProFeature } from '@/lib/stripe';

export type PlanGateResult = {
  planId: PlanId;
  status: string;
  hasFeature: (feature: ProFeature) => boolean;
  isActive: boolean;
  isPastDue: boolean;
  currentPeriodEnd: string | null;
};

/**
 * Resolves the active subscription plan for a project.
 * Returns 'starter' (default) if no subscription exists.
 *
 * Server-only. Uses service client (called from other server actions + page.tsx).
 */
export async function getPlanForProject(projectId: string): Promise<PlanGateResult> {
  const supabase = createServiceClient();

  const { data: sub } = await supabase
    .from('project_subscriptions')
    .select('plan_id, status, current_period_end')
    .eq('project_id', projectId)
    .in('status', ['active', 'past_due', 'trialing'])
    .limit(1)
    .maybeSingle();

  const planId: PlanId = (sub?.plan_id as PlanId) ?? 'starter';
  const status = sub?.status ?? 'active';
  const planFeatures = PLAN_CONFIG[planId].features;

  return {
    planId,
    status,
    hasFeature: (feature: ProFeature) => planFeatures.includes(feature),
    isActive: status === 'active' || status === 'trialing',
    isPastDue: status === 'past_due',
    currentPeriodEnd: sub?.current_period_end ?? null,
  };
}
