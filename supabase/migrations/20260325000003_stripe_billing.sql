-- ============================================================
-- Week 10: Stripe Billing Infrastructure
-- Applied via Supabase MCP — this file is a git reference copy
-- ============================================================

-- 1A. Add stripe_customer_id to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 1B. Create project_subscriptions table
CREATE TABLE public.project_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES public.organizations(id),
  project_id              UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT NOT NULL,
  stripe_subscription_id  TEXT UNIQUE NOT NULL,
  plan_id                 TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan_id IN ('starter', 'pro', 'portfolio')),
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete', 'unpaid')),
  current_period_end      TIMESTAMPTZ,
  cancel_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_subscriptions IS
  'Stripe billing per project. One customer per org, subscriptions per project. Webhook handler uses UPSERT on stripe_subscription_id for idempotency.';

-- 1C. Indexes
CREATE INDEX idx_project_subscriptions_org_id
  ON public.project_subscriptions(org_id);

CREATE INDEX idx_project_subscriptions_project_id
  ON public.project_subscriptions(project_id);

CREATE INDEX idx_project_subscriptions_stripe_customer
  ON public.project_subscriptions(stripe_customer_id);

-- Partial unique: at most ONE active/past_due/trialing subscription per project
CREATE UNIQUE INDEX idx_project_subscriptions_active_unique
  ON public.project_subscriptions(project_id)
  WHERE status IN ('active', 'past_due', 'trialing');

-- 1D. RLS
ALTER TABLE public.project_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_own_subscriptions"
  ON public.project_subscriptions FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "service_role_manage_subscriptions"
  ON public.project_subscriptions FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- 1E. Expand audit_log CHECK constraint with billing actions
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_action_check CHECK (
    action = ANY (ARRAY[
      'field_report_submitted', 'status_changed', 'delay_logged', 'delay_resolved',
      'corrective_action_created', 'corrective_action_acknowledged',
      'corrective_action_in_resolution', 'corrective_action_resolved',
      'nod_generated', 'nod_sent', 'nod_reminder_sent',
      'rea_generated', 'evidence_package_generated', 'receipt_opened',
      'gc_verification_approved', 'gc_correction_requested',
      'trade_mode_switched', 'config_change',
      'invite_created', 'invite_redeemed', 'foreman_invited',
      'subscription_created', 'subscription_updated', 'payment_failed'
    ])
  );
