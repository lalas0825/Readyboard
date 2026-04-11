/**
 * PowerSync Schema for ReadyBoard Mobile (Foreman + Superintendent)
 * v5.1 — Updated for area_trade_status + area_tasks (checklist system)
 *
 * ARCHITECTURE:
 * - PowerSync + SQLite = source of truth for READS on mobile client
 * - WRITES go to local SQLite first, then PowerSync syncs to Supabase
 * - Supabase RLS validates all writes on the server side
 * - GC Web Dashboard reads directly from Supabase Realtime (no PowerSync)
 *
 * SYNC STRATEGY:
 * - Only tables needed by mobile users sync here
 * - Legal docs, forecasts, benchmarks, schedule = server/web only
 * - Conflict resolution: last-write-wins using offline_created_at
 *
 * PLATFORM: Uses @powersync/common for platform-agnostic schema.
 * Both @powersync/react-native and @powersync/web consume this schema.
 */

import { column, Schema, Table } from '@powersync/common';

// --- Core reference tables (read-only on mobile) ---

const projects = new Table({
  name: column.text,
  address: column.text,
  labor_rate_per_hour: column.real,
  legal_jurisdiction: column.text,
  sha256_enabled: column.integer, // boolean as 0/1
  gc_org_id: column.text,
  sub_org_id: column.text,
  created_at: column.text,
}, { indexes: {} });

const areas = new Table({
  name: column.text,
  floor: column.text,
  area_type: column.text,
  project_id: column.text,
  total_sqft: column.real,
  original_sqft: column.real,
  unit_id: column.text,
  area_code: column.text,
  description: column.text,
  sort_order: column.integer,
  created_at: column.text,
}, { indexes: {} });

const units = new Table({
  project_id: column.text,
  floor: column.text,
  name: column.text,
  unit_type: column.text,
  sort_order: column.integer,
  created_at: column.text,
  updated_at: column.text,
}, { indexes: {} });

const trade_sequences = new Table({
  project_id: column.text,
  area_type: column.text,
  trade_name: column.text,
  sequence_order: column.integer,
}, { indexes: {} });

const user_assignments = new Table({
  user_id: column.text,
  area_id: column.text,
  trade_name: column.text,
}, { indexes: {} });

const users = new Table({
  email: column.text,
  phone: column.text,
  name: column.text,
  role: column.text, // foreman | sub_pm | superintendent | gc_super | gc_pm | gc_admin | owner
  language: column.text, // en | es
  org_id: column.text,
}, { indexes: {} });

// --- Status tracking (read/write on mobile) ---

const area_trade_status = new Table({
  area_id: column.text,
  trade_type: column.text,
  reporting_mode: column.text, // percentage | checklist
  manual_pct: column.real,
  calculated_pct: column.real,
  effective_pct: column.real, // THE universal currency
  all_gates_passed: column.integer, // boolean: 0/1. Gates block READY even at 99%
  gc_verification_pending: column.integer, // boolean: 0/1
  gc_verification_pending_since: column.text,
  project_id: column.text, // denormalized for project-level sync
  started_at: column.text,   // Fix 2: when sub first reported progress > 0%
  completed_at: column.text, // Fix 2: when sub reached 100%, cleared on regression
  updated_at: column.text,
}, { indexes: {} });

const field_reports = new Table({
  area_id: column.text,
  user_id: column.text,
  trade_name: column.text,
  status: column.text, // done | working | blocked
  progress_pct: column.integer, // 0-100
  reason_code: column.text, // no_heat | prior_trade | no_access | inspection | plumbing | material | moisture | other
  notes: column.text, // free text for 'other' reason code
  gps_lat: column.real,
  gps_lng: column.real,
  photo_url: column.text,
  photo_type: column.text, // Fix 3: progress | blocker | evidence | safety
  device_id: column.text,
  app_version: column.text,
  offline_created_at: column.text, // device timestamp for conflict resolution
  created_at: column.text,
}, { indexes: {} });

// --- Delay & corrective action (read on mobile) ---

const delay_logs = new Table({
  area_id: column.text,
  trade_name: column.text,
  reason_code: column.text,
  started_at: column.text,
  ended_at: column.text,
  man_hours: column.real,
  daily_cost: column.real,
  cumulative_cost: column.real,
  crew_size: column.integer,
  nod_draft_id: column.text,
  rea_id: column.text,
  receipt_confirmed: column.integer, // boolean as 0/1
}, { indexes: {} });

const nod_drafts = new Table({
  delay_log_id: column.text,
  draft_content: column.text, // JSON string (SQLite has no JSONB)
  reminder_sent_at: column.text,
  sent_at: column.text,
  sent_by: column.text,
}, { indexes: {} });

const corrective_actions = new Table({
  delay_log_id: column.text,
  assigned_to: column.text,
  deadline: column.text,
  note: column.text,
  created_at: column.text,
  acknowledged_at: column.text,
  in_resolution_at: column.text,
  resolved_at: column.text,
  created_by: column.text,
}, { indexes: {} });

// --- Checklist system V1.1 (read/write on mobile) ---

const area_tasks = new Table({
  area_id: column.text,
  trade_type: column.text,
  task_template_id: column.text,
  task_order: column.integer,
  task_name_en: column.text,
  task_name_es: column.text,
  task_owner: column.text, // sub | gc — RLS enforced: sub can't complete gc tasks
  is_gate: column.integer, // boolean: 0/1. Gates = hard stop even at 99%
  weight: column.real,
  status: column.text, // pending | complete | blocked | na | correction_requested
  completed_at: column.text,
  completed_by: column.text,
  completed_by_role: column.text,
  photo_url: column.text,
  notes: column.text,
  gps_lat: column.real,
  gps_lon: column.real,
  // GC verification chain timestamps
  verification_requested_at: column.text,
  notification_sent_at: column.text,
  notification_opened_at: column.text,
  reminder_sent_at: column.text,
  escalation_flagged_at: column.text,
  // Correction flow
  correction_reason: column.text,
  correction_note: column.text,
  correction_requested_at: column.text,
  correction_requested_by: column.text,
  correction_resolved_at: column.text,
  updated_at: column.text,
}, { indexes: {} });

// --- Feedback reports (write on mobile, read own reports) ---

const feedback_reports = new Table({
  project_id: column.text,
  reported_by: column.text,
  reporter_name: column.text,
  reporter_role: column.text,
  type: column.text,    // bug | feature_request | feedback | question
  severity: column.text,
  title: column.text,
  description: column.text,
  app_source: column.text,
  device_info: column.text,
  screenshots: column.text, // JSON string
  status: column.text,
  admin_notes: column.text,
  admin_response: column.text,
  resolved_at: column.text,
  created_at: column.text,
}, { indexes: {} });

// --- Area Notes (per-area communication log) ---

const area_notes = new Table({
  project_id: column.text,
  area_id: column.text,
  author_id: column.text,
  author_name: column.text,
  author_role: column.text,
  content: column.text,
  is_system: column.integer, // boolean: 0/1
  created_at: column.text,
}, { indexes: {} });

// --- Schema export ---

export const AppSchema = new Schema({
  projects,
  areas,
  units,
  trade_sequences,
  user_assignments,
  users,
  area_trade_status,
  field_reports,
  delay_logs,
  nod_drafts,
  corrective_actions,
  area_tasks,
  area_notes,
  feedback_reports,
});

export type Database = (typeof AppSchema)['types'];

/**
 * TABLES NOT SYNCED TO MOBILE (server/web only):
 *
 * - organizations: GC/Sub company management (web admin only)
 * - legal_documents: PDFs, SHA-256 hashes, receipt tracking (server-side generation)
 * - receipt_events: Email tracking pixel events (server webhook)
 * - production_benchmarks: PM-configured rates (web config only)
 * - forecast_snapshots: Calculated projections (server cron job)
 * - schedule_items: P6/CSV imported schedule (web upload only)
 * - scope_changes: Change orders (web + server)
 * - trade_task_templates: Template library (web admin config, area_tasks are the instances)
 */
