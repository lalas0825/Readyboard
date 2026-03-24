-- ============================================================
-- ReadyBoard v1.0 — Golden Snapshot Schema
-- Generated: 2026-03-24
-- Supabase Project: errxmhgqksdasxccumtz
-- 24 tables | 61 RLS policies | 26 functions | 19 audit actions
-- ============================================================

-- ─── TABLES ─────────────────────────────────────────────────

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gc', 'sub')),
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en', 'es')),
  logo_url TEXT,
  legal_template_version TEXT DEFAULT '1.0',
  signature_on_file BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  labor_rate_per_hour NUMERIC NOT NULL DEFAULT 85.00,
  legal_jurisdiction TEXT NOT NULL DEFAULT 'NY',
  sha256_enabled BOOLEAN NOT NULL DEFAULT true,
  gc_org_id UUID NOT NULL REFERENCES organizations(id),
  sub_org_id UUID REFERENCES organizations(id),
  safety_gate_enabled BOOLEAN DEFAULT false,
  nod_threshold_hours NUMERIC DEFAULT 24,
  rea_threshold_cost NUMERIC DEFAULT 5000,
  rea_threshold_crew_days INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  phone TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('foreman','sub_pm','superintendent','gc_super','gc_pm','gc_admin','owner')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es')),
  org_id UUID NOT NULL REFERENCES organizations(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  floor TEXT NOT NULL,
  area_type TEXT NOT NULL CHECK (area_type IN ('bathroom','kitchen','corridor','office','lobby','utility')),
  project_id UUID NOT NULL REFERENCES projects(id),
  total_sqft NUMERIC,
  original_sqft NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trade_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  area_type TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE area_trade_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id),
  trade_type TEXT NOT NULL,
  reporting_mode TEXT NOT NULL DEFAULT 'percentage' CHECK (reporting_mode IN ('percentage', 'checklist')),
  manual_pct NUMERIC DEFAULT 0 CHECK (manual_pct >= 0 AND manual_pct <= 100),
  calculated_pct NUMERIC DEFAULT 0 CHECK (calculated_pct >= 0 AND calculated_pct <= 100),
  effective_pct NUMERIC NOT NULL DEFAULT 0 CHECK (effective_pct >= 0 AND effective_pct <= 100),
  all_gates_passed BOOLEAN NOT NULL DEFAULT true,
  gc_verification_pending BOOLEAN DEFAULT false,
  gc_verification_pending_since TIMESTAMPTZ,
  last_notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trade_task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id),
  trade_type TEXT NOT NULL,
  area_type TEXT NOT NULL,
  task_order INTEGER NOT NULL CHECK (task_order > 0),
  task_name_en TEXT NOT NULL,
  task_name_es TEXT NOT NULL,
  verification_criteria TEXT,
  task_owner TEXT NOT NULL CHECK (task_owner IN ('sub', 'gc')),
  is_gate BOOLEAN NOT NULL DEFAULT false,
  is_inspection BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC NOT NULL DEFAULT 1.00 CHECK (weight > 0),
  gate_timeout_hours INTEGER DEFAULT 4 CHECK (gate_timeout_hours > 0),
  requires_photo BOOLEAN DEFAULT false,
  default_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE area_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id),
  trade_type TEXT NOT NULL,
  task_template_id UUID REFERENCES trade_task_templates(id),
  task_order INTEGER NOT NULL CHECK (task_order > 0),
  task_name_en TEXT NOT NULL,
  task_name_es TEXT NOT NULL,
  task_owner TEXT NOT NULL CHECK (task_owner IN ('sub', 'gc')),
  is_gate BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC NOT NULL DEFAULT 1.00 CHECK (weight > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','blocked','na','correction_requested')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  completed_by_role TEXT,
  photo_url TEXT,
  notes TEXT,
  gps_lat NUMERIC,
  gps_lon NUMERIC,
  verification_requested_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ,
  notification_opened_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  escalation_flagged_at TIMESTAMPTZ,
  correction_reason TEXT,
  correction_note TEXT,
  correction_requested_at TIMESTAMPTZ,
  correction_requested_by UUID REFERENCES users(id),
  correction_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_trade_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  trade_type TEXT NOT NULL,
  reporting_mode TEXT NOT NULL DEFAULT 'percentage' CHECK (reporting_mode IN ('percentage', 'checklist')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  UNIQUE (project_id, trade_type)
);

CREATE TABLE field_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id),
  user_id UUID NOT NULL REFERENCES users(id),
  trade_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done','working','blocked')),
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  reason_code TEXT CHECK (reason_code IN ('no_heat','prior_trade','no_access','inspection','plumbing','material','moisture')),
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  photo_url TEXT,
  device_id TEXT,
  app_version TEXT,
  offline_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delay_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id),
  trade_name TEXT NOT NULL,
  reason_code TEXT NOT NULL CHECK (reason_code IN ('no_heat','prior_trade','no_access','inspection','plumbing','material','moisture','safety','other')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  man_hours NUMERIC DEFAULT 0,
  daily_cost NUMERIC DEFAULT 0,
  cumulative_cost NUMERIC DEFAULT 0,
  crew_size INTEGER DEFAULT 1 CHECK (crew_size > 0),
  nod_draft_id UUID,
  rea_id UUID,
  receipt_confirmed BOOLEAN DEFAULT false,
  legal_status TEXT CHECK (legal_status IS NULL OR legal_status IN ('pending','draft','sent','signed')),
  evidence_path TEXT,
  evidence_hash TEXT,
  is_change_order BOOLEAN DEFAULT false,
  change_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE corrective_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delay_log_id UUID NOT NULL REFERENCES delay_logs(id),
  assigned_to UUID NOT NULL REFERENCES users(id),
  deadline TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  in_resolution_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE nod_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delay_log_id UUID NOT NULL REFERENCES delay_logs(id),
  draft_content JSONB NOT NULL DEFAULT '{}',
  draft_pdf_path TEXT,
  reminder_sent_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('nod','rea','evidence')),
  area_id UUID REFERENCES areas(id),
  trade_name TEXT,
  total_claim_amount NUMERIC,
  locale TEXT DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  sha256_hash TEXT,
  receipt_tracking_uuid UUID DEFAULT uuid_generate_v4(),
  first_opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  published_to_gc BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  signature_png_url TEXT,
  pdf_url TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rea_delay_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_document_id UUID NOT NULL REFERENCES legal_documents(id),
  delay_log_id UUID NOT NULL REFERENCES delay_logs(id),
  man_hours NUMERIC NOT NULL DEFAULT 0,
  cost_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE receipt_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id),
  event_type TEXT NOT NULL DEFAULT 'open',
  ip_address INET,
  device_type TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delay_log_id UUID NOT NULL UNIQUE REFERENCES delay_logs(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  proposed_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE schedule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  area_id UUID REFERENCES areas(id),
  area_name TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  planned_start DATE,
  planned_finish DATE,
  baseline_finish DATE,
  actual_finish DATE,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  p6_activity_id TEXT,
  manual_override_date DATE,
  override_reason TEXT,
  override_by UUID REFERENCES users(id),
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scope_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id),
  delta_sqft NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  change_order_ref TEXT,
  initiated_by UUID NOT NULL REFERENCES users(id),
  gc_initiated BOOLEAN DEFAULT false,
  forecast_impact_days INTEGER,
  change_order_id UUID REFERENCES change_orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE production_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  trade_name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  sqft_per_hour_per_person NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  area_id UUID REFERENCES areas(id),
  trade_type TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_pct NUMERIC,
  actual_rate NUMERIC,
  benchmark_rate NUMERIC,
  projected_date DATE,
  scheduled_date DATE,
  delta_days INTEGER,
  recommendations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  area_id UUID NOT NULL REFERENCES areas(id),
  trade_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'manual_override', 'status_change', 'scope_change', 'config_change',
    'import', 'legal_doc_sent', 'legal_doc_published', 'legal_draft_created',
    'change_order_created', 'change_order_approved', 'change_order_rejected',
    'ca_created', 'ca_acknowledged', 'ca_resolved',
    'rea_generated', 'evidence_package_generated', 'receipt_opened',
    'gc_verification_approved', 'gc_correction_requested'
  )),
  changed_by UUID NOT NULL REFERENCES users(id),
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── FUNCTIONS (26 total) ───────────────────────────────────

-- Helper functions (SECURITY DEFINER)
-- get_user_role()          → TEXT
-- get_user_org_id()        → UUID
-- get_accessible_area_ids() → SETOF UUID
-- is_gc_role()             → BOOLEAN
-- is_sub_role()            → BOOLEAN
-- is_sub_management()      → BOOLEAN

-- Trigger functions
-- calculate_effective_pct()    → TRIGGER (BEFORE UPDATE on area_trade_status)
-- propagate_task_change()      → TRIGGER (AFTER INSERT/UPDATE on area_tasks)
-- propagate_report_to_ats()    → TRIGGER (AFTER INSERT on field_reports)
-- recalculate_delay_costs()    → TRIGGER (BEFORE UPDATE on delay_logs)
-- close_delay_on_ca_resolved() → TRIGGER (AFTER UPDATE on corrective_actions)
-- guard_delay_log_reopen()     → TRIGGER (BEFORE UPDATE on delay_logs)
-- guard_legal_immutability()   → TRIGGER (BEFORE UPDATE on legal_documents)
-- prevent_delay_log_delete()   → TRIGGER (BEFORE DELETE on delay_logs)
-- update_updated_at()          → TRIGGER (BEFORE UPDATE on multiple tables)
-- handle_new_user()            → TRIGGER (AFTER INSERT on auth.users)

-- RPC functions (SECURITY DEFINER)
-- gc_approve_verification(p_area_id, p_trade_type, p_user_id)           → JSONB
-- gc_request_correction(p_task_ids[], p_area_id, p_trade_type, ...)     → JSONB
-- switch_trade_mode(p_project_id, p_trade_type, p_new_mode, p_user_id) → JSONB
-- import_schedule_batch(p_project_id, p_items, p_user_id)               → JSONB
-- upsert_forecast_snapshots(p_project_id, p_snapshots)                  → INTEGER

-- Computed functions
-- delay_duration_hours()         → NUMERIC
-- delay_current_man_hours()      → NUMERIC
-- delay_computed_daily_cost()    → NUMERIC
-- delay_computed_cumulative_cost() → NUMERIC
-- validate_template_weights()    → BOOLEAN

-- ─── RLS POLICIES (61 total) ───────────────────────────────
-- See pg_policies for full detail. Key patterns:
--   area_tasks:           6 policies (GC CRUD + Sub read/complete, owner-segregated)
--   area_trade_status:    4 policies (GC/Sub/Foreman read, GC update)
--   areas:                3 policies (role-based visibility)
--   legal_documents:      4 policies (Sub private until published, GC sees published only)
--   project_trade_configs: 4 policies (GC CRUD + service bypass)
--   trade_task_templates: 4 policies (system defaults visible to all, org-scoped CRUD)
--   All other tables follow org-isolation + project-scope patterns

-- ─── SEED DATA ──────────────────────────────────────────────
-- organizations: Tishman Speyer (GC), Jantile Inc (Sub)
-- projects: 383 Madison Avenue, NYC
-- areas: 30 (bathrooms, kitchens, corridors, offices across 3 floors)
-- trade_sequences: 14-trade interior finish sequence
-- trade_task_templates: 211 tasks (14 trades x 4 area types, SUB/GC tagged)
-- area_trade_status: 420 (30 areas x 14 trades)
-- production_benchmarks: Rough Plumbing baseline
