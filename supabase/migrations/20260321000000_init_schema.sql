-- ============================================================
-- ReadyBoard v5.1 — Complete Schema Migration
-- Applied via Supabase MCP on 2026-03-21
--
-- Migration History (tracked by Supabase MCP):
--   20260321000121 — create_core_tables
--   20260321000150 — create_reporting_tables
--   20260321000216 — create_legal_tables
--   20260321000235 — create_schedule_forecast_tables
--   20260321000305 — create_checklist_tables
--   20260321000419 — create_rls_policies
--   20260321000448 — create_functions_triggers
--   20260321000701 — seed_383_madison
--   20260321001042 — fix_function_search_paths
--   20260321XXXXXX — fix_rls_circular_recursion
--
-- This file is the canonical reference for git.
-- DO NOT re-run — migrations already applied via MCP.
-- ============================================================

-- ===================== EXTENSIONS =====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================== 19 TABLES =====================

-- 1. organizations (GC or sub company)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gc', 'sub')),
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en', 'es')),
  logo_url TEXT,
  legal_template_version TEXT DEFAULT '1.0',
  signature_on_file BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  labor_rate_per_hour NUMERIC(10,2) NOT NULL DEFAULT 85.00,
  legal_jurisdiction TEXT NOT NULL DEFAULT 'NY',
  sha256_enabled BOOLEAN NOT NULL DEFAULT true,
  gc_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  sub_org_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. users (references auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'foreman', 'sub_pm', 'superintendent',
    'gc_super', 'gc_pm', 'gc_admin', 'owner'
  )),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es')),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. areas
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  floor TEXT NOT NULL,
  area_type TEXT NOT NULL CHECK (area_type IN (
    'bathroom', 'kitchen', 'corridor', 'office', 'lobby', 'utility'
  )),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  total_sqft NUMERIC(10,2),
  original_sqft NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. trade_sequences
CREATE TABLE trade_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  area_type TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, area_type, trade_name),
  UNIQUE(project_id, area_type, sequence_order)
);

-- 6. user_assignments
CREATE TABLE user_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  trade_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, area_id, trade_name)
);

-- 7. production_benchmarks
CREATE TABLE production_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  trade_name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  sqft_per_hour_per_person NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, trade_name, area_type)
);

-- 8. area_trade_status (bridges % and checklist modes)
CREATE TABLE area_trade_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL,
  reporting_mode TEXT NOT NULL DEFAULT 'percentage' CHECK (reporting_mode IN ('percentage', 'checklist')),
  manual_pct NUMERIC(5,2) DEFAULT 0 CHECK (manual_pct >= 0 AND manual_pct <= 100),
  calculated_pct NUMERIC(5,2) DEFAULT 0 CHECK (calculated_pct >= 0 AND calculated_pct <= 100),
  effective_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (effective_pct >= 0 AND effective_pct <= 100),
  all_gates_passed BOOLEAN NOT NULL DEFAULT true,
  gc_verification_pending BOOLEAN DEFAULT false,
  gc_verification_pending_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(area_id, trade_type)
);

-- 9. field_reports
CREATE TABLE field_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  trade_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'working', 'blocked')),
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  reason_code TEXT CHECK (reason_code IN (
    'no_heat', 'prior_trade', 'no_access', 'inspection',
    'plumbing', 'material', 'moisture'
  )),
  gps_lat NUMERIC(10,7),
  gps_lng NUMERIC(10,7),
  photo_url TEXT,
  device_id TEXT,
  app_version TEXT,
  offline_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. delay_logs
CREATE TABLE delay_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  trade_name TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  man_hours NUMERIC(10,2) DEFAULT 0,
  daily_cost NUMERIC(10,2) DEFAULT 0,
  cumulative_cost NUMERIC(12,2) DEFAULT 0,
  crew_size INTEGER DEFAULT 1 CHECK (crew_size > 0),
  nod_draft_id UUID,
  rea_id UUID,
  receipt_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. corrective_actions
CREATE TABLE corrective_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delay_log_id UUID NOT NULL REFERENCES delay_logs(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES users(id),
  deadline TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  in_resolution_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- 12. legal_documents (PRIVATE to sub until published)
CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL CHECK (type IN ('nod', 'rea', 'evidence')),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. nod_drafts (NEVER auto-sent)
CREATE TABLE nod_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delay_log_id UUID NOT NULL REFERENCES delay_logs(id) ON DELETE CASCADE,
  draft_content JSONB NOT NULL DEFAULT '{}',
  reminder_sent_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deferred FKs (circular references)
ALTER TABLE delay_logs ADD CONSTRAINT fk_delay_logs_nod_draft
  FOREIGN KEY (nod_draft_id) REFERENCES nod_drafts(id) ON DELETE SET NULL;
ALTER TABLE delay_logs ADD CONSTRAINT fk_delay_logs_rea
  FOREIGN KEY (rea_id) REFERENCES legal_documents(id) ON DELETE SET NULL;

-- 14. receipt_events (constructive notice)
CREATE TABLE receipt_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'open',
  ip_address INET,
  device_type TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. schedule_items (P6 import)
CREATE TABLE schedule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  area_name TEXT NOT NULL,
  trade_name TEXT NOT NULL,
  planned_start DATE,
  planned_finish DATE,
  p6_activity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. scope_changes
CREATE TABLE scope_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  delta_sqft NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  change_order_ref TEXT,
  initiated_by UUID NOT NULL REFERENCES users(id),
  gc_initiated BOOLEAN DEFAULT false,
  forecast_impact_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. forecast_snapshots
CREATE TABLE forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_pct NUMERIC(5,2),
  actual_rate NUMERIC(8,2),
  benchmark_rate NUMERIC(8,2),
  projected_date DATE,
  scheduled_date DATE,
  delta_days INTEGER,
  recommendations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. trade_task_templates (V1.1 checklist system)
CREATE TABLE trade_task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL,
  area_type TEXT NOT NULL,
  task_order INTEGER NOT NULL CHECK (task_order > 0),
  task_name_en TEXT NOT NULL,
  task_name_es TEXT NOT NULL,
  verification_criteria TEXT,
  task_owner TEXT NOT NULL CHECK (task_owner IN ('sub', 'gc')),
  is_gate BOOLEAN NOT NULL DEFAULT false,
  is_inspection BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
  gate_timeout_hours INTEGER DEFAULT 4 CHECK (gate_timeout_hours > 0),
  requires_photo BOOLEAN DEFAULT false,
  default_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. area_tasks (task instances — SUB/GC ownership, RLS enforced)
CREATE TABLE area_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL,
  task_template_id UUID REFERENCES trade_task_templates(id) ON DELETE SET NULL,
  task_order INTEGER NOT NULL CHECK (task_order > 0),
  task_name_en TEXT NOT NULL,
  task_name_es TEXT NOT NULL,
  task_owner TEXT NOT NULL CHECK (task_owner IN ('sub', 'gc')),
  is_gate BOOLEAN NOT NULL DEFAULT false,
  weight NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'complete', 'blocked', 'na', 'correction_requested'
  )),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  completed_by_role TEXT,
  photo_url TEXT,
  notes TEXT,
  gps_lat NUMERIC(10,7),
  gps_lon NUMERIC(10,7),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===================== RLS =====================
-- RLS enabled on ALL 19 tables.
-- 33 policies total. Key policies:
--   1. Organization isolation (GC A ≠ GC B)
--   2. Project-scoped access
--   3. Foreman sees only assigned areas
--   4. Sub PM sees all sub project areas
--   5. GC sees all project areas
--   6. Legal docs PRIVATE to sub until published_to_gc = true
--   7. SUB completes SUB tasks only (area_tasks RLS)
--   8. GC completes GC tasks only (area_tasks RLS)
-- See create_rls_policies migration for full SQL.

-- ===================== FUNCTIONS =====================
-- 7 functions (all with SET search_path = public):
--   get_user_org_id()        — helper for RLS
--   get_user_role()          — helper for RLS
--   is_gc_role()             — helper for RLS
--   is_sub_role()            — helper for RLS
--   update_updated_at()      — auto-update trigger
--   calculate_effective_pct() — universal currency trigger
--   handle_new_user()        — auth signup hook

-- ===================== TRIGGERS =====================
-- 12 × update_updated_at triggers (one per table with updated_at)
-- 1 × calculate_effective_pct on area_trade_status
-- 1 × handle_new_user on auth.users INSERT
