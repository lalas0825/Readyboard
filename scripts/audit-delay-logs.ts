/**
 * Delay Log Integrity Audit
 *
 * Validates every delay_log in the database:
 * 1. area_id references a valid area linked to an existing project
 * 2. started_at is not null (schema enforces, but double-check data)
 * 3. If closed (ended_at != null), ended_at > started_at
 * 4. crew_size > 0
 * 5. No orphaned logs (area deleted but log remains)
 *
 * Run: npx tsx scripts/audit-delay-logs.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  console.error('Run with: SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/audit-delay-logs.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type Finding = {
  severity: 'ERROR' | 'WARN';
  delay_log_id: string;
  message: string;
};

async function audit() {
  console.log('═══════════════════════════════════════════');
  console.log('  DELAY LOG INTEGRITY AUDIT');
  console.log('═══════════════════════════════════════════\n');

  const findings: Finding[] = [];

  // ─── Fetch all delay_logs with area join ──────────
  const { data: logs, error } = await supabase
    .from('delay_logs')
    .select(`
      id,
      area_id,
      trade_name,
      reason_code,
      started_at,
      ended_at,
      man_hours,
      daily_cost,
      cumulative_cost,
      crew_size,
      areas ( id, name, project_id, projects ( id, name ) )
    `);

  if (error) {
    console.error('Failed to fetch delay_logs:', error.message);
    process.exit(1);
  }

  if (!logs || logs.length === 0) {
    console.log('No delay_logs found. Nothing to audit.\n');
    process.exit(0);
  }

  console.log(`Found ${logs.length} delay_log(s). Running checks...\n`);

  for (const log of logs) {
    const area = log.areas as unknown as Record<string, unknown> | null;
    const project = area?.projects as Record<string, unknown> | null;

    // Check 1: Valid area reference
    if (!area || !area.id) {
      findings.push({
        severity: 'ERROR',
        delay_log_id: log.id,
        message: `Orphaned log — area_id ${log.area_id} does not exist`,
      });
    }

    // Check 2: Area linked to valid project
    if (area && (!project || !project.id)) {
      findings.push({
        severity: 'ERROR',
        delay_log_id: log.id,
        message: `Area "${area.name}" has no valid project reference`,
      });
    }

    // Check 3: started_at is present (schema enforces NOT NULL, but verify data)
    if (!log.started_at) {
      findings.push({
        severity: 'ERROR',
        delay_log_id: log.id,
        message: 'started_at is null — invalid delay log',
      });
    }

    // Check 4: If closed, ended_at > started_at
    if (log.ended_at && log.started_at) {
      const start = new Date(log.started_at).getTime();
      const end = new Date(log.ended_at).getTime();
      if (end <= start) {
        findings.push({
          severity: 'ERROR',
          delay_log_id: log.id,
          message: `ended_at (${log.ended_at}) is not after started_at (${log.started_at})`,
        });
      }
    }

    // Check 5: crew_size > 0
    if (log.crew_size !== null && log.crew_size <= 0) {
      findings.push({
        severity: 'ERROR',
        delay_log_id: log.id,
        message: `crew_size is ${log.crew_size} — must be > 0`,
      });
    }

    // Check 6: Warn if costs are zero on active delays
    if (!log.ended_at && Number(log.daily_cost) === 0 && log.reason_code !== 'safety') {
      findings.push({
        severity: 'WARN',
        delay_log_id: log.id,
        message: `Active delay with daily_cost = 0 (reason: ${log.reason_code})`,
      });
    }

    // Check 7: Warn if man_hours is zero on active delays
    if (!log.ended_at && Number(log.man_hours) === 0 && log.reason_code !== 'safety') {
      findings.push({
        severity: 'WARN',
        delay_log_id: log.id,
        message: `Active delay with man_hours = 0 (reason: ${log.reason_code})`,
      });
    }
  }

  // ─── Summary ──────────────────────────────────────
  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warnings = findings.filter((f) => f.severity === 'WARN');

  const active = logs.filter((l) => !l.ended_at).length;
  const closed = logs.filter((l) => l.ended_at).length;

  console.log('─── Results ───────────────────────────────\n');
  console.log(`  Total logs:   ${logs.length}`);
  console.log(`  Active:       ${active}`);
  console.log(`  Closed:       ${closed}`);
  console.log(`  Errors:       ${errors.length}`);
  console.log(`  Warnings:     ${warnings.length}\n`);

  if (findings.length === 0) {
    console.log('  ✓ All delay_logs passed integrity checks.\n');
  } else {
    for (const f of findings) {
      const icon = f.severity === 'ERROR' ? '✗' : '!';
      console.log(`  ${icon} [${f.severity}] ${f.delay_log_id.slice(0, 8)}... — ${f.message}`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════\n');

  if (errors.length > 0) {
    console.error(`AUDIT FAILED: ${errors.length} error(s) found.`);
    process.exit(1);
  }

  console.log('AUDIT PASSED.');
  process.exit(0);
}

audit();
