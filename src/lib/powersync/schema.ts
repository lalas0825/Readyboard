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
 */

import { Column, ColumnType, Schema, Table } from '@powersync/web';

// --- Core reference tables (read-only on mobile) ---

const projects = new Table({
  name: Column(ColumnType.TEXT),
  address: Column(ColumnType.TEXT),
  labor_rate_per_hour: Column(ColumnType.REAL),
  legal_jurisdiction: Column(ColumnType.TEXT),
  sha256_enabled: Column(ColumnType.INTEGER), // boolean as 0/1
  gc_org_id: Column(ColumnType.TEXT),
  sub_org_id: Column(ColumnType.TEXT),
  created_at: Column(ColumnType.TEXT),
}, { indexes: {} });

const areas = new Table({
  name: Column(ColumnType.TEXT),
  floor: Column(ColumnType.TEXT),
  area_type: Column(ColumnType.TEXT),
  project_id: Column(ColumnType.TEXT),
  total_sqft: Column(ColumnType.REAL),
  original_sqft: Column(ColumnType.REAL),
  created_at: Column(ColumnType.TEXT),
}, { indexes: {} });

const trade_sequences = new Table({
  project_id: Column(ColumnType.TEXT),
  area_type: Column(ColumnType.TEXT),
  trade_name: Column(ColumnType.TEXT),
  sequence_order: Column(ColumnType.INTEGER),
}, { indexes: {} });

const user_assignments = new Table({
  user_id: Column(ColumnType.TEXT),
  area_id: Column(ColumnType.TEXT),
  trade_name: Column(ColumnType.TEXT),
}, { indexes: {} });

const users = new Table({
  email: Column(ColumnType.TEXT),
  phone: Column(ColumnType.TEXT),
  name: Column(ColumnType.TEXT),
  role: Column(ColumnType.TEXT), // foreman | sub_pm | superintendent | gc_super | gc_pm | gc_admin | owner
  language: Column(ColumnType.TEXT), // en | es
  org_id: Column(ColumnType.TEXT),
}, { indexes: {} });

// --- Status tracking (read/write on mobile) ---

const area_trade_status = new Table({
  area_id: Column(ColumnType.TEXT),
  trade_type: Column(ColumnType.TEXT),
  reporting_mode: Column(ColumnType.TEXT), // percentage | checklist
  manual_pct: Column(ColumnType.REAL),
  calculated_pct: Column(ColumnType.REAL),
  effective_pct: Column(ColumnType.REAL), // THE universal currency
  all_gates_passed: Column(ColumnType.INTEGER), // boolean: 0/1. Gates block READY even at 99%
  gc_verification_pending: Column(ColumnType.INTEGER), // boolean: 0/1
  gc_verification_pending_since: Column(ColumnType.TEXT),
  updated_at: Column(ColumnType.TEXT),
}, { indexes: {} });

const field_reports = new Table({
  area_id: Column(ColumnType.TEXT),
  user_id: Column(ColumnType.TEXT),
  trade_name: Column(ColumnType.TEXT),
  status: Column(ColumnType.TEXT), // done | working | blocked
  progress_pct: Column(ColumnType.INTEGER), // 0-100
  reason_code: Column(ColumnType.TEXT), // no_heat | prior_trade | no_access | inspection | plumbing | material | moisture
  gps_lat: Column(ColumnType.REAL),
  gps_lng: Column(ColumnType.REAL),
  photo_url: Column(ColumnType.TEXT),
  device_id: Column(ColumnType.TEXT),
  app_version: Column(ColumnType.TEXT),
  offline_created_at: Column(ColumnType.TEXT), // device timestamp for conflict resolution
  created_at: Column(ColumnType.TEXT),
}, { indexes: {} });

// --- Delay & corrective action (read on mobile) ---

const delay_logs = new Table({
  area_id: Column(ColumnType.TEXT),
  trade_name: Column(ColumnType.TEXT),
  reason_code: Column(ColumnType.TEXT),
  started_at: Column(ColumnType.TEXT),
  ended_at: Column(ColumnType.TEXT),
  man_hours: Column(ColumnType.REAL),
  daily_cost: Column(ColumnType.REAL),
  cumulative_cost: Column(ColumnType.REAL),
  crew_size: Column(ColumnType.INTEGER),
  nod_draft_id: Column(ColumnType.TEXT),
  rea_id: Column(ColumnType.TEXT),
  receipt_confirmed: Column(ColumnType.INTEGER), // boolean as 0/1
}, { indexes: {} });

const nod_drafts = new Table({
  delay_log_id: Column(ColumnType.TEXT),
  draft_content: Column(ColumnType.TEXT), // JSON string (SQLite has no JSONB)
  reminder_sent_at: Column(ColumnType.TEXT),
  sent_at: Column(ColumnType.TEXT),
  sent_by: Column(ColumnType.TEXT),
}, { indexes: {} });

const corrective_actions = new Table({
  delay_log_id: Column(ColumnType.TEXT),
  assigned_to: Column(ColumnType.TEXT),
  deadline: Column(ColumnType.TEXT),
  note: Column(ColumnType.TEXT),
  created_at: Column(ColumnType.TEXT),
  acknowledged_at: Column(ColumnType.TEXT),
  in_resolution_at: Column(ColumnType.TEXT),
  resolved_at: Column(ColumnType.TEXT),
  created_by: Column(ColumnType.TEXT),
}, { indexes: {} });

// --- Checklist system V1.1 (read/write on mobile) ---

const area_tasks = new Table({
  area_id: Column(ColumnType.TEXT),
  trade_type: Column(ColumnType.TEXT),
  task_template_id: Column(ColumnType.TEXT),
  task_order: Column(ColumnType.INTEGER),
  task_name_en: Column(ColumnType.TEXT),
  task_name_es: Column(ColumnType.TEXT),
  task_owner: Column(ColumnType.TEXT), // sub | gc — RLS enforced: sub can't complete gc tasks
  is_gate: Column(ColumnType.INTEGER), // boolean: 0/1. Gates = hard stop even at 99%
  weight: Column(ColumnType.REAL),
  status: Column(ColumnType.TEXT), // pending | complete | blocked | na | correction_requested
  completed_at: Column(ColumnType.TEXT),
  completed_by: Column(ColumnType.TEXT),
  completed_by_role: Column(ColumnType.TEXT),
  photo_url: Column(ColumnType.TEXT),
  notes: Column(ColumnType.TEXT),
  gps_lat: Column(ColumnType.REAL),
  gps_lon: Column(ColumnType.REAL),
  // GC verification chain timestamps
  verification_requested_at: Column(ColumnType.TEXT),
  notification_sent_at: Column(ColumnType.TEXT),
  notification_opened_at: Column(ColumnType.TEXT),
  reminder_sent_at: Column(ColumnType.TEXT),
  escalation_flagged_at: Column(ColumnType.TEXT),
  // Correction flow
  correction_reason: Column(ColumnType.TEXT),
  correction_note: Column(ColumnType.TEXT),
  correction_requested_at: Column(ColumnType.TEXT),
  correction_requested_by: Column(ColumnType.TEXT),
  correction_resolved_at: Column(ColumnType.TEXT),
  updated_at: Column(ColumnType.TEXT),
}, { indexes: {} });

// --- Schema export ---

export const AppSchema = new Schema({
  projects,
  areas,
  trade_sequences,
  user_assignments,
  users,
  area_trade_status,
  field_reports,
  delay_logs,
  nod_drafts,
  corrective_actions,
  area_tasks,
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
