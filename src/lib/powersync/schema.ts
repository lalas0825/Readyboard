/**
 * PowerSync Schema for ReadyBoard Mobile (Foreman + Superintendent)
 *
 * ARCHITECTURE:
 * - PowerSync + SQLite = source of truth for READS on mobile client
 * - WRITES go to local SQLite first, then PowerSync syncs to Supabase
 * - Supabase RLS validates all writes on the server side
 * - GC Web Dashboard reads directly from Supabase (no PowerSync)
 *
 * SYNC STRATEGY:
 * - Only tables needed by mobile users sync here
 * - Legal docs, forecasts, benchmarks are server/web only
 * - Conflict resolution: last-write-wins using offline_created_at
 */

import { Column, ColumnType, Schema, Table } from '@powersync/web';

// --- Tables that sync to mobile devices ---

const projects = new Table({
  name: Column(ColumnType.TEXT),
  address: Column(ColumnType.TEXT),
  labor_rate_per_hour: Column(ColumnType.REAL),
  legal_jurisdiction: Column(ColumnType.TEXT),
  sha256_enabled: Column(ColumnType.INTEGER), // boolean as 0/1
  org_id: Column(ColumnType.TEXT),
  created_at: Column(ColumnType.TEXT),
}, { indexes: {} });

const areas = new Table({
  name: Column(ColumnType.TEXT),
  floor: Column(ColumnType.TEXT),
  area_type: Column(ColumnType.TEXT),
  project_id: Column(ColumnType.TEXT),
  total_sqft: Column(ColumnType.REAL),
  status: Column(ColumnType.TEXT), // READY | ALMOST | BLOCKED | HELD | DONE
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
  role: Column(ColumnType.TEXT), // foreman | sub_pm | superintendent | gc_pm | gc_admin
  language: Column(ColumnType.TEXT), // en | es
  org_id: Column(ColumnType.TEXT),
}, { indexes: {} });

const field_reports = new Table({
  area_id: Column(ColumnType.TEXT),
  user_id: Column(ColumnType.TEXT),
  status: Column(ColumnType.TEXT), // DONE | WORKING | BLOCKED
  progress: Column(ColumnType.INTEGER), // 0-100
  reason_code: Column(ColumnType.TEXT), // no_heat | prior_trade | no_access | inspection | plumbing | material | moisture
  gps_lat: Column(ColumnType.REAL),
  gps_lng: Column(ColumnType.REAL),
  photo_url: Column(ColumnType.TEXT),
  created_at: Column(ColumnType.TEXT),
  offline_created_at: Column(ColumnType.TEXT), // device timestamp for conflict resolution
  device_id: Column(ColumnType.TEXT),
}, { indexes: {} });

const delay_logs = new Table({
  area_id: Column(ColumnType.TEXT),
  trade_name: Column(ColumnType.TEXT),
  reason_code: Column(ColumnType.TEXT),
  started_at: Column(ColumnType.TEXT),
  man_hours: Column(ColumnType.REAL),
  daily_cost: Column(ColumnType.REAL),
  cumulative_cost: Column(ColumnType.REAL),
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

// --- Schema export ---

export const AppSchema = new Schema({
  projects,
  areas,
  trade_sequences,
  user_assignments,
  users,
  field_reports,
  delay_logs,
  nod_drafts,
  corrective_actions,
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
 */
