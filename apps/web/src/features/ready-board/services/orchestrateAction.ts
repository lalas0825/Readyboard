'use server';

// ─── Payload Type ────────────────────────────────────

type OrchestratePayload = {
  event_type: 'corrective_action.created';
  project_id: string;
  action_id: string;
  delay_log_id: string;
  area_id: string;
  trade_name: string;
  assigned_to: string;
  assigned_to_name: string;
  deadline: string;
  note: string | null;
  status: string;
  created_by: string;
  created_at: string;
  client_latency_ms: number;
};

// ─── Retry Configuration ─────────────────────────────

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s

/**
 * Server action: fires webhook to external orchestration systems (n8n, Make).
 *
 * - Reads WEBHOOK_ACTION_URL from server-only env
 * - Retries 3 times with exponential backoff (1s, 2s, 4s)
 * - Graceful degradation: if no URL configured, returns silently
 * - Fire-and-forget from client — never affects actionMap state
 */
export async function orchestrateAction(payload: OrchestratePayload): Promise<void> {
  const webhookUrl = process.env.WEBHOOK_ACTION_URL;

  // Graceful degradation — no webhook configured
  if (!webhookUrl) return;

  const body = JSON.stringify({
    ...payload,
    source: 'readyboard',
    version: '1.0',
    timestamp: new Date().toISOString(),
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) return;

      // 4xx = client error, no retry
      if (response.status >= 400 && response.status < 500) {
        console.error(`[Orchestrator] Webhook returned ${response.status} — not retrying`);
        return;
      }
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error('[Orchestrator] All retries exhausted:', err);
        return;
      }
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
