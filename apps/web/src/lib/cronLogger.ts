import { createServiceClient } from '@/lib/supabase/service';
import { resend, EMAIL_FROM } from '@/lib/email/client';

const ADMIN_EMAIL = 'latinprofx@gmail.com';
const CONSECUTIVE_FAIL_THRESHOLD = 3;

type CronLogEntry = {
  job_name: string;
  status: 'success' | 'partial' | 'failed';
  processed_count: number;
  error_message?: string;
  duration_ms: number;
  metadata?: Record<string, unknown>;
};

/**
 * Logs cron job execution to cron_logs table.
 * If 3 consecutive failures detected, sends admin alert email.
 */
export async function logCronRun(entry: CronLogEntry): Promise<void> {
  const supabase = createServiceClient();

  try {
    await supabase.from('cron_logs').insert({
      job_name: entry.job_name,
      status: entry.status,
      processed_count: entry.processed_count,
      error_message: entry.error_message ?? null,
      duration_ms: entry.duration_ms,
      metadata: entry.metadata ?? {},
    });

    // Check for consecutive failures → alert admin
    if (entry.status === 'failed') {
      const { data: recentLogs } = await supabase
        .from('cron_logs')
        .select('status')
        .eq('job_name', entry.job_name)
        .order('created_at', { ascending: false })
        .limit(CONSECUTIVE_FAIL_THRESHOLD);

      const allFailed = recentLogs?.length === CONSECUTIVE_FAIL_THRESHOLD &&
        recentLogs.every((l) => l.status === 'failed');

      if (allFailed) {
        await sendFailAlert(entry.job_name, entry.error_message ?? 'Unknown error');
      }
    }
  } catch (err) {
    // Logging itself should never crash the app
    console.error('[CronLogger] Failed to log:', err);
  }
}

async function sendFailAlert(jobName: string, errorMessage: string): Promise<void> {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: ADMIN_EMAIL,
      subject: `[ReadyBoard] CRON ALERT: ${jobName} failed 3x`,
      text: `The cron job "${jobName}" has failed ${CONSECUTIVE_FAIL_THRESHOLD} consecutive times.\n\nLast error: ${errorMessage}\n\nCheck cron_logs table for details.\n\nTimestamp: ${new Date().toISOString()}`,
    });
  } catch {
    console.error('[CronLogger] Failed to send alert email');
  }
}
